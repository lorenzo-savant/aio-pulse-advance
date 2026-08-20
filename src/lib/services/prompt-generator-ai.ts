// PATH: src/lib/services/prompt-generator-ai.ts
//
// AI-driven augmentation for the prompt generator. Sits ON TOP OF the
// static template engine in prompt-generator.ts — it doesn't replace it.
//
// The static template engine (`generatePrompts`) produces a deterministic
// 20-30 prompts from preset templates × brand × competitors × categories.
// This file complements those with 5-10 ADDITIONAL prompts the static
// templates would miss — non-obvious phrasings, idiomatic local queries,
// and the kind of long-tail questions users actually type that don't fit
// a templatable pattern.
//
// Why Groq first: llama-3.3-70b-versatile is fast (≤ 2 sec for our JSON-output
// size), the free tier is generous, and structured-JSON mode is well-supported.
// callLLM is a RESILIENT free-first chain — Groq → Cerebras → Mistral → Gemini
// → OpenAI — that falls back on error/429, so one provider's free-tier limit
// degrades gracefully instead of breaking the call.

import { z } from 'zod'
import { logger } from '@/lib/logger'
import { GEMINI_DEFAULT_ENGINE_MODEL } from './ai-router'
import { getIndustryPreset, type Locale } from './prompt-generator'

// ─── Public types ───────────────────────────────────────────────────────────

export interface AiGeneratedPrompt {
  /** The query text — same shape as template-generated prompts. */
  text: string
  /** B1-B5 intent bucket the LLM judges this prompt belongs to. */
  intentBucket: 'B1' | 'B2' | 'B3' | 'B4' | 'B5'
  /** Estimated priority for monitoring (high = monitor daily). */
  priority: 'high' | 'medium' | 'low'
  /** One-sentence rationale for why this prompt is valuable. */
  rationale: string
  /** Engine(s) the LLM judges most likely to surface this brand for this query. */
  targetEngines: Array<'chatgpt' | 'gemini' | 'perplexity' | 'claude'>
}

export interface AiGenerationResult {
  prompts: AiGeneratedPrompt[]
  provider: string
  model: string
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const AiPromptSchema = z.object({
  text: z.string().min(5).max(300),
  intentBucket: z.enum(['B1', 'B2', 'B3', 'B4', 'B5']),
  priority: z.enum(['high', 'medium', 'low']),
  rationale: z.string().min(5).max(300),
  targetEngines: z
    .array(z.enum(['chatgpt', 'gemini', 'perplexity', 'claude']))
    .min(1)
    .max(4),
})

const AiOutputSchema = z.object({
  prompts: z.array(AiPromptSchema).min(1).max(10),
})

// ─── Provider chain ────────────────────────────────────────────────────────

export interface LLMCall {
  text: string
  provider: string
  model: string
}

// Groq model for the high-volume JSON path (prompt generation + extraction).
// Default Llama 3.3 70B — best JSON + multilingual balance for our workload.
// Override with GROQ_MODEL to A/B another Groq model (e.g. a Qwen build for
// stronger sv/it). Verify the exact current model ID in the Groq console.
const GROQ_MODEL = process.env['GROQ_MODEL'] || 'llama-3.3-70b-versatile'

async function callGroq(systemPrompt: string, userPrompt: string): Promise<LLMCall> {
  const apiKey = process.env['GROQ_API_KEY']
  if (!apiKey) throw new Error('GROQ_API_KEY not set')
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.4, // slightly higher than the strict-analysis path —
      // we want some variation in the prompts, not deterministic output
      max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Groq HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty response from Groq')
  return { text, provider: 'groq', model: GROQ_MODEL }
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<LLMCall> {
  const apiKey = process.env['GEMINI_API_KEY']
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_DEFAULT_ENGINE_MODEL}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        // Disable thinking budget — see ai-router.ts for the same trick
        // (thinking tokens consume the output budget and truncate JSON).
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Gemini HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty response from Gemini')
  return { text, provider: 'gemini', model: GEMINI_DEFAULT_ENGINE_MODEL }
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<LLMCall> {
  const apiKey = process.env['OPENAI_API_KEY']
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenAI HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty response from OpenAI')
  return { text, provider: 'openai', model: 'gpt-4o-mini' }
}

// Cerebras — OpenAI-compatible, free tier, very fast Llama inference. Sits
// right after Groq as a second free Llama provider.
async function callCerebras(systemPrompt: string, userPrompt: string): Promise<LLMCall> {
  const apiKey = process.env['CEREBRAS_API_KEY']
  if (!apiKey) throw new Error('CEREBRAS_API_KEY not set')
  const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b',
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Cerebras HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty response from Cerebras')
  return { text, provider: 'cerebras', model: 'llama-3.3-70b' }
}

// Mistral — OpenAI-compatible, free tier. JSON mode supported.
async function callMistral(systemPrompt: string, userPrompt: string): Promise<LLMCall> {
  const apiKey = process.env['MISTRAL_API_KEY']
  if (!apiKey) throw new Error('MISTRAL_API_KEY not set')
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Mistral HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty response from Mistral')
  return { text, provider: 'mistral', model: 'mistral-small-latest' }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Generic JSON-mode LLM call with a RESILIENT free-first provider chain:
 *   Groq → Cerebras → Mistral → Gemini → OpenAI
 * Each CONFIGURED provider (by API key) is tried in order; on error or rate
 * limit (429) it falls back to the next — with a short backoff on 429 — so a
 * single provider hitting its free-tier limit degrades gracefully instead of
 * breaking the call. Exported so other services (advisor, llms.txt enrichment)
 * reuse the exact same behavior. Returns raw text; caller parses/validates.
 */
export async function callLLM(systemPrompt: string, userPrompt: string): Promise<LLMCall> {
  const chain: Array<{ name: string; run: () => Promise<LLMCall> }> = []
  if (process.env['GROQ_API_KEY'])
    chain.push({ name: 'groq', run: () => callGroq(systemPrompt, userPrompt) })
  if (process.env['CEREBRAS_API_KEY'])
    chain.push({ name: 'cerebras', run: () => callCerebras(systemPrompt, userPrompt) })
  if (process.env['MISTRAL_API_KEY'])
    chain.push({ name: 'mistral', run: () => callMistral(systemPrompt, userPrompt) })
  if (process.env['GEMINI_API_KEY'])
    chain.push({ name: 'gemini', run: () => callGemini(systemPrompt, userPrompt) })
  if (process.env['OPENAI_API_KEY'])
    chain.push({ name: 'openai', run: () => callOpenAI(systemPrompt, userPrompt) })

  if (chain.length === 0) {
    throw new Error(
      'No LLM provider configured. Set GROQ_API_KEY (recommended), CEREBRAS_API_KEY, MISTRAL_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY.',
    )
  }

  const errors: string[] = []
  for (let i = 0; i < chain.length; i++) {
    const p = chain[i]!
    try {
      return await p.run()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${p.name}: ${msg}`)
      const isLast = i === chain.length - 1
      logger.warn(`callLLM: provider ${p.name} failed${isLast ? '' : ', falling back'}`, {
        service: 'prompt-generator-ai',
        provider: p.name,
        error: msg,
      })
      // Rate-limited: brief pause before trying the next provider.
      if (/\b429\b/.test(msg) && !isLast) await sleep(400)
    }
  }
  throw new Error(
    'All LLM providers failed:\n' + errors.map((e, idx) => `  ${idx + 1}. ${e}`).join('\n'),
  )
}

// ─── Prompts ───────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return [
    'You are an expert in Answer Engine Optimization (AEO) and Generative Engine Optimization (GEO).',
    'Your job is to suggest realistic, idiomatic search queries a USER would type into ChatGPT / Gemini / Perplexity / Claude when researching a brand or its industry.',
    '',
    'RULES — these are absolute:',
    '1. Output a single JSON object: { "prompts": [...] }. JSON only, no prose, no markdown fences.',
    '2. Generate 5-10 prompts that DO NOT overlap with the ones supplied as "existing prompts" in the user message.',
    '3. Every prompt must be a real query a human would type — short, conversational, in the requested locale.',
    '4. Distribute across intent buckets: B1 (brand/competitor), B2 (category), B3 (problem/JTBD), B4 (buyer intent), B5 (compliance/risk). At least 3 buckets must be represented.',
    '5. Use the locale natively — do NOT translate English templates. Each language has its own phrasing patterns. For Swedish use natural svenska, for Italian use natural italiano.',
    '6. `targetEngines` is your judgment of which AI engines are most likely to surface the monitored brand for this query. The only valid engines are "chatgpt", "gemini", "perplexity" — never propose any other. Prefer Perplexity for question-style queries with citations; ChatGPT for category/listing queries; Gemini for queries that benefit from Google grounding.',
    '7. `priority` reflects monitoring value — high = run daily, medium = weekly, low = monthly.',
    "8. `rationale` must explain WHY this prompt is useful in one sentence. Don't restate the prompt.",
    '9. GROUNDING IS A HARD CONSTRAINT, NOT A STYLE. Every prompt MUST be grounded in the BRAND REALITY in the user message (the verified description of what the brand actually is, does, sells and offers). A prompt not supported by the BRAND REALITY is INVALID — do not output it.',
    '10. PERSONALIZE — never generic. Cover ONLY the facets the BRAND REALITY actually supports, drawn from: what it does · what it sells / offers / proposes · how it works · delivery / shipping · returns / warranty · pricing or price-comparison · trust / reviews · geographic coverage / markets. If a facet is not in the BRAND REALITY, write NO prompt about it. Never fabricate a facet.',
    '11. FORBIDDEN — presupposition. Do NOT assume the brand sells physical products, runs a store, ships goods, or offers any service the BRAND REALITY does not state. NEVER produce "what products does X sell" / "vad säljer X" / "quali prodotti vende X" (or equivalents) UNLESS the BRAND REALITY explicitly says the brand sells its OWN products. If the brand is a platform / marketplace / aggregator / meta-search / comparison / directory, use ONLY find / compare / discover / evaluate framing — the thing it "offers" is the search/comparison service itself, never a product catalogue.',
    '12. MANDATORY SELF-CHECK before returning: re-read each prompt against the BRAND REALITY and DELETE any that assumes a product, service, capability, channel or attribute it does not support. When in doubt, omit. Correctness overrides the 5-10 target — returning as few as 3 is correct when the BRAND REALITY is narrow; never pad with presumptuous prompts.',
    '13. THIN OR MISSING BRAND REALITY: if it is empty or too vague to ground specifics, output ONLY safe brand-agnostic prompts (the brand name, reviews, reliability, "is X legit", alternatives to X). Do NOT invent a business model, product line, services or shipping.',
    '',
    'Schema:',
    '{ "prompts": [ { "text": string, "intentBucket": "B1"|"B2"|"B3"|"B4"|"B5", "priority": "high"|"medium"|"low", "rationale": string, "targetEngines": ("chatgpt"|"gemini"|"perplexity")[] } ] }',
  ].join('\n')
}

interface AugmentInput {
  brand: string
  brandDomain?: string | null
  industryId: string
  locale: Locale
  competitors: string[]
  existingPrompts: string[]
  location?: string | null
  /** Verified, brand-specific facts — what the brand ACTUALLY is, does, sells
   *  and offers. This is what stops the generator presupposing generic-industry
   *  attributes (e.g. inventing a product catalogue for a meta-search brand). */
  brandDescription?: string | null
  /** "NOT to be confused with <same-named company>" note, when the brand name
   *  collides with another entity. Keeps prompts anchored to THIS company. */
  disambiguation?: string | null
}

function buildUserPrompt(input: AugmentInput, presetSummary: string): string {
  const localeLabel =
    input.locale === 'sv' ? 'Swedish' : input.locale === 'it' ? 'Italian' : 'English'
  return [
    `BRAND: ${input.brand}`,
    input.brandDomain ? `DOMAIN: ${input.brandDomain}` : '',
    `LOCALE: ${input.locale} (${localeLabel}) — write prompts natively in this language.`,
    input.location ? `LOCATION: ${input.location} — include geographic intent in 1-2 prompts.` : '',
    '',
    input.brandDescription && input.brandDescription.trim()
      ? `BRAND REALITY (verified — what this brand ACTUALLY is / does / sells / offers; ground EVERY prompt in this, never contradict or exceed it):\n"""\n${input.brandDescription.trim().slice(0, 1500)}\n"""`
      : 'BRAND REALITY: not provided — stay generic and do NOT invent specific products, services, shipping, or a business model for this brand.',
    input.disambiguation && input.disambiguation.trim()
      ? `DISAMBIGUATION (a different company shares this name — do not confuse them): ${input.disambiguation.trim().slice(0, 500)}`
      : '',
    '',
    'FACETS TO COVER — only those that genuinely apply to THIS brand per the reality above: what it does · what it sells / offers / proposes · how it works · delivery / shipping · returns / warranty · pricing or price-comparison · trust / reviews · geographic coverage. Skip any facet the brand does not have; never fabricate one.',
    '',
    `INDUSTRY PRESET: ${input.industryId} (the GENERIC vertical — the BRAND REALITY above OVERRIDES it wherever they differ)`,
    `PRESET CONTEXT: ${presetSummary}`,
    '',
    input.competitors.length > 0
      ? `KNOWN COMPETITORS: ${input.competitors.join(', ')}`
      : 'KNOWN COMPETITORS: none configured — feel free to surface obvious players.',
    '',
    'EXISTING PROMPTS (the static template engine already produced these — DO NOT repeat them):',
    ...input.existingPrompts.slice(0, 30).map((p, i) => `  ${i + 1}. ${p}`),
    '',
    'Return NEW prompts (JSON only, up to 10) that complement these — non-obvious phrasings, long-tail questions, idiomatic local search behavior. Then APPLY THE SELF-CHECK: every prompt must be grounded in the BRAND REALITY above; delete any that presume a product, service, shipping or attribute it does not state. Returning fewer correct prompts is better than more presumptuous ones.',
  ]
    .filter(Boolean)
    .join('\n')
}

// ─── Deterministic backstop for rule 11 ──────────────────────────────────────
// Some models still emit "what products does X sell" for a brand that sells
// nothing of its own. The prompt rule alone is not a guarantee, so when the
// brand's verified reality / industry marks it a comparison / meta-search /
// aggregator, we DROP those presupposing prompts in code — the LLM can slip,
// the filter cannot.

/** Strong signal the brand does not sell its own products (it aggregates,
 *  compares, or lists other sellers). Checked against description + industry. */
const NON_SELLER_SIGNAL =
  /(meta[- ]?s[öo]k|meta[- ]?search|aggregat|j[äa]mf[öo]r|prisj[äa]mf|price[- ]?compar|comparison|comparatore|confront[oa]\s+prezzi|marknadsportal|s[öo]kmotor|search engine|directory|aggregator)/i

/** True when the industry or the verified facts mark the brand a non-seller
 *  (aggregator / comparison / meta-search). Exported for unit testing. */
export function isNonSellerBrand(industryId: string, factsText: string): boolean {
  if (industryId === 'recommerce-comparison') return true
  return NON_SELLER_SIGNAL.test(factsText)
}

function sellsNothingOfItsOwn(input: AugmentInput): boolean {
  return isNonSellerBrand(
    input.industryId,
    `${input.brandDescription ?? ''} ${input.disambiguation ?? ''}`,
  )
}

// A prompt "presupposes selling" only when it pairs a sell-verb with a
// product-noun — so "how do I SELL on X" (no product noun) and "where to
// COMPARE prices on products" (no sell-verb) are NOT caught. Multi-locale.
const SELL_VERB = /(s[äa]ljer|s[äa]ljs|s[äa]lja|sells?|selling|vende|vendono|vendere)/i
const PRODUCT_NOUN =
  /(produkter|produkt|products?|prodotti|prodotto|sortiment|varor|catalogue|catalog|katalog)/i

/** A prompt presupposes the brand sells its own products (a sell-verb paired
 *  with a product-noun). Exported for unit testing. */
export function presupposesOwnProducts(text: string): boolean {
  return SELL_VERB.test(text) && PRODUCT_NOUN.test(text)
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Augment the static template-generated prompts with AI-suggested
 * additions. Reads brand + preset + competitors + the existing prompts
 * so the LLM doesn't duplicate what's already covered.
 *
 * Returns 5-10 new prompts validated against AiOutputSchema. Throws if
 * NO LLM provider is configured. Soft-fails (returns empty) on parse
 * errors so the caller can still proceed with template-only output.
 */
export async function augmentWithAiPrompts(input: AugmentInput): Promise<AiGenerationResult> {
  const preset = getIndustryPreset(input.industryId)
  if (!preset) {
    throw new Error(`Industry preset "${input.industryId}" not found`)
  }

  const presetSummary = [
    preset.name[input.locale],
    '—',
    preset.description[input.locale],
    `Categories: ${preset.categories[input.locale].slice(0, 5).join(', ')}.`,
    `Roles: ${preset.roles[input.locale].slice(0, 5).join(', ')}.`,
  ].join(' ')

  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(input, presetSummary)

  let llm: LLMCall
  try {
    llm = await callLLM(systemPrompt, userPrompt)
  } catch (err) {
    logger.warn('prompt-generator-ai: LLM call failed', {
      err: err instanceof Error ? err.message : String(err),
    })
    throw err
  }

  // Strip optional ```json fences and parse.
  const cleaned = llm.text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  let parsed: z.infer<typeof AiOutputSchema>
  try {
    parsed = AiOutputSchema.parse(JSON.parse(cleaned))
  } catch (err) {
    logger.warn('prompt-generator-ai: failed to parse/validate', {
      err: err instanceof Error ? err.message : String(err),
      rawLength: llm.text.length,
      rawHead: llm.text.slice(0, 300),
    })
    return { prompts: [], provider: llm.provider, model: llm.model }
  }

  // De-duplicate against the existing-prompts set (case-insensitive,
  // trimmed). The LLM is instructed not to overlap, but defense in depth.
  const existingSet = new Set(input.existingPrompts.map((p) => p.toLowerCase().trim()))
  const unique = parsed.prompts.filter((p) => !existingSet.has(p.text.toLowerCase().trim()))

  // Deterministic backstop for rule 11: a brand that sells nothing of its own
  // never gets "what products does X sell" prompts, even if the model slipped.
  let clean = unique
  if (sellsNothingOfItsOwn(input)) {
    const dropped = unique.filter((p) => presupposesOwnProducts(p.text)).map((p) => p.text)
    if (dropped.length > 0) {
      clean = unique.filter((p) => !presupposesOwnProducts(p.text))
      logger.info('prompt-generator-ai: dropped presupposing prompts for a non-seller brand', {
        brand: input.brand,
        dropped: dropped.length,
        examples: dropped.slice(0, 3),
      })
    }
  }

  return { prompts: clean, provider: llm.provider, model: llm.model }
}
