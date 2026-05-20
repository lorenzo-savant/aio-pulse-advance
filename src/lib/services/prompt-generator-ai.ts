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
// Why Groq specifically: llama-3.3-70b-versatile is fast (≤ 2 sec for
// our JSON-output size), the free tier is generous, and structured-JSON
// mode is well-supported. Falls back to Gemini → OpenAI when GROQ_API_KEY
// is not set, mirroring the chain in advisor.ts.

import { z } from 'zod'
import { logger } from '@/lib/logger'
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

interface LLMCall {
  text: string
  provider: string
  model: string
}

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
      model: 'llama-3.3-70b-versatile',
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
  return { text, provider: 'groq', model: 'llama-3.3-70b-versatile' }
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<LLMCall> {
  const apiKey = process.env['GEMINI_API_KEY']
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  return { text, provider: 'gemini', model: 'gemini-2.5-flash' }
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

async function callLLM(systemPrompt: string, userPrompt: string): Promise<LLMCall> {
  if (process.env['GROQ_API_KEY']) {
    return callGroq(systemPrompt, userPrompt)
  }
  if (process.env['GEMINI_API_KEY']) {
    return callGemini(systemPrompt, userPrompt)
  }
  if (process.env['OPENAI_API_KEY']) {
    return callOpenAI(systemPrompt, userPrompt)
  }
  throw new Error(
    'No LLM provider configured. Set GROQ_API_KEY (recommended), GEMINI_API_KEY, or OPENAI_API_KEY.',
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
    '6. `targetEngines` is your judgment of which AI engines are most likely to surface the monitored brand for this query. Prefer Perplexity for question-style queries with citations; ChatGPT for category/listing queries; Gemini for queries that benefit from Google grounding; Claude for nuanced reasoning queries.',
    '7. `priority` reflects monitoring value — high = run daily, medium = weekly, low = monthly.',
    "8. `rationale` must explain WHY this prompt is useful in one sentence. Don't restate the prompt.",
    '',
    'Schema:',
    '{ "prompts": [ { "text": string, "intentBucket": "B1"|"B2"|"B3"|"B4"|"B5", "priority": "high"|"medium"|"low", "rationale": string, "targetEngines": ("chatgpt"|"gemini"|"perplexity"|"claude")[] } ] }',
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
    `INDUSTRY PRESET: ${input.industryId}`,
    `PRESET CONTEXT: ${presetSummary}`,
    '',
    input.competitors.length > 0
      ? `KNOWN COMPETITORS: ${input.competitors.join(', ')}`
      : 'KNOWN COMPETITORS: none configured — feel free to surface obvious players.',
    '',
    'EXISTING PROMPTS (the static template engine already produced these — DO NOT repeat them):',
    ...input.existingPrompts.slice(0, 30).map((p, i) => `  ${i + 1}. ${p}`),
    '',
    'Return 5-10 NEW prompts (JSON only) that complement these — non-obvious phrasings, long-tail questions, idiomatic local search behavior.',
  ]
    .filter(Boolean)
    .join('\n')
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

  return { prompts: unique, provider: llm.provider, model: llm.model }
}
