// PATH: src/lib/services/ai-router.ts
// AI Router — routes engine simulation and brand analysis to the 4 core providers.
// Core providers: ChatGPT (OpenAI), Gemini (Google), Perplexity, Claude (Anthropic).

import type { Brand, MonitoringEngine } from '@/types'
import { isOpenAIAvailable, callOpenAI, callOpenAIWithWebSearch } from './openai'
import { isPerplexityAvailable, callPerplexityWithCitations } from './perplexity'
import { isAnthropicAvailable, callAnthropic, callAnthropicWithWebSearch } from './anthropic'
import { logger } from '@/lib/logger'
import { enrichPromptWithBrandContext } from '@/lib/brand-enrichment'
import { safeFetch, SsrfError } from '@/lib/utils/safe-fetch'
import type { PromptLang } from '@/lib/prompt-library'

const LANGUAGE_LABEL: Record<PromptLang, string> = {
  en: 'English',
  it: 'Italian (Italiano)',
  sv: 'Swedish (Svenska)',
}

// Localizes each engine's web search to the brand's market so results match
// what a real user in that locale would see.
const LOCALE_COUNTRY: Record<PromptLang, string> = {
  en: 'US',
  it: 'IT',
  sv: 'SE',
}

// Web search makes ChatGPT/Claude answer from the LIVE web (real data + real
// citations) instead of model memory. It costs more per call, so it can be
// disabled with ENGINE_WEB_SEARCH=false (then those engines fall back to
// model-memory answers + Brave-grounded citations).
function isEngineWebSearchEnabled(): boolean {
  const v = process.env['ENGINE_WEB_SEARCH']
  return v !== 'false' && v !== '0'
}

interface CallGeminiOptions {
  /**
   * Set `true` for JSON / structured-output tasks. Disables Gemini 2.5
   * Flash's built-in "thinking" feature and asks for application/json
   * output. Without this, thinking tokens consume the maxOutputTokens
   * budget and the JSON response gets truncated mid-token (real bug
   * observed in monitoring runs: response cut off at ~200 chars / ~50
   * tokens, leaving an unparseable string like `"senti...`).
   */
  jsonMode?: boolean
  /**
   * Model id override. Engine-simulation call sites pass
   * geminiEngineModel() so the GEMINI_ENGINE_MODEL env override reaches
   * them; the analysis path (analyzeResponseForBrand) deliberately does
   * NOT — the measurement instrument and the analysis brain are separate
   * roles, and bumping one must not silently move the other.
   */
  model?: string
}

async function callGeminiFallback(
  prompt: string,
  options: CallGeminiOptions = {},
): Promise<string> {
  const apiKey = process.env['GEMINI_API_KEY']
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  // 8192 tokens is the safety net even with thinking disabled — analysis
  // JSON is small (~500 tokens) but giving headroom avoids surprises on
  // larger competitor lists / hallucination flag arrays.
  const generationConfig: Record<string, unknown> = {
    temperature: 0.2,
    maxOutputTokens: 8192,
  }
  if (options.jsonMode) {
    generationConfig.responseMimeType = 'application/json'
    // Per Gemini 2.5 docs: thinkingBudget=0 disables the thinking phase
    // entirely. Critical for JSON tasks where every token of the budget
    // must go to the actual output.
    generationConfig.thinkingConfig = { thinkingBudget: 0 }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${options.model ?? GEMINI_DEFAULT_ENGINE_MODEL}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) throw new Error(`Gemini API error ${res.status}`)
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty response from Gemini')
  return text
}

function isGeminiAvailable(): boolean {
  return Boolean(process.env['GEMINI_API_KEY'])
}

// ─── Gemini engine model selection ──────────────────────────────────────────
//
// The model that SIMULATES the Gemini engine is a measurement instrument:
// changing it shifts every brand's numbers, so the default is pinned and an
// override is an explicit ops decision (annotate dashboards when you flip it).
//
// GEMINI_ENGINE_MODEL accepts any generateContent model id that supports the
// googleSearch tool (per https://ai.google.dev/gemini-api/docs/google-search:
// 2.0 Flash, 2.5 Flash/Pro, 3.x Flash — current newest is 3.6 Flash).
//
// Two deliberate non-migrations, revisit when the pricing math is done:
// - We stay on generateContent rather than the newer Interactions API
//   (client.interactions.create). Interactions is GA and recommended, but it
//   changes the response shape (url_citation annotations instead of
//   groundingMetadata) and our parsing + tests are built on the latter.
// - Gemini 3.x models bill grounded requests PER SEARCH QUERY EXECUTED, not
//   per prompt like 2.5. A model bump via this env var is therefore also a
//   billing-model change. The free-tier arithmetic (Aug 2026) actually favors
//   staying: 2.5 grants 1,500 grounded requests/DAY free (then ~$35/1k),
//   3.x grants 5,000/MONTH shared (~166/day equivalent, then ~$14/1k).
//   Our grounded volume is tens per day — 2.5's daily allowance dwarfs it,
//   3.x's monthly pool would not. Claude was retired over exactly this class
//   of billing surprise; see docs/features/api-costs.md.

const GEMINI_DEFAULT_ENGINE_MODEL = 'gemini-2.5-flash'

export function geminiEngineModel(): string {
  return process.env['GEMINI_ENGINE_MODEL'] || GEMINI_DEFAULT_ENGINE_MODEL
}

/** Provider label recorded in monitoring_results.response_provider.
 *  The default model keeps the exact legacy label ('gemini:flash-2.5') so
 *  historical rows and new rows aggregate together; an overridden model gets
 *  an honest label carrying the real model id, so a bump is visible in the
 *  data instead of hiding behind the old name. */
export function geminiProviderLabel(mode: 'search' | 'plain'): string {
  const model = geminiEngineModel()
  const base = model === GEMINI_DEFAULT_ENGINE_MODEL ? 'gemini:flash-2.5' : `gemini:${model}`
  return mode === 'search' ? `${base}+search` : base
}

// Gemini with Google Search grounding — returns text + real web citations.
interface GeminiGroundingResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>
      webSearchQueries?: string[]
    }
  }>
}

async function callGeminiWithSearch(
  prompt: string,
): Promise<{ text: string; citations: string[] }> {
  const apiKey = process.env['GEMINI_API_KEY']
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiEngineModel()}:generateContent`
  const doFetch = () =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
      signal: AbortSignal.timeout(45_000),
    })

  let res = await doFetch()

  // One bounded retry on 429 only. Production showed grounded-call quota as
  // THE dominant failure ("Gemini (search) 429" chains in the fallback log):
  // every 429 that falls through to the plain call produces a Gemini row with
  // no engine citations, which is exactly the data this function exists to
  // capture. A single 2s backoff rescues per-minute rate blips; daily-quota
  // exhaustion still falls back like before. Other statuses fail fast —
  // retrying a 400/500 spends cron time for nothing.
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 2_000))
    res = await doFetch()
  }

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini Search API error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = (await res.json()) as GeminiGroundingResponse
  const candidate = data.candidates?.[0]
  const text = candidate?.content?.parts?.[0]?.text || ''
  const chunks = candidate?.groundingMetadata?.groundingChunks || []
  const rawUris = chunks
    .map((c) => c.web?.uri)
    .filter((u): u is string => typeof u === 'string' && u.length > 0)
  // Vertex AI Grounding wraps every source URL in a redirect of the form
  // https://vertexaisearch.cloud.google.com/grounding-api-redirect/... — that's
  // an internal Google routing URL, not a citation source. Without resolution
  // it pollutes Citation Sources dashboards (one report showed 32% of all
  // citations were this single redirect host). resolveVertexRedirects follows
  // each one to its final destination so the dashboard sees real sources.
  const citations = await resolveVertexRedirects(rawUris)
  return { text, citations }
}

// ─── Vertex Grounding redirect resolver ─────────────────────────────────────
//
// Vertex AI returns grounding URIs like
//   https://vertexaisearch.cloud.google.com/grounding-api-redirect/<token>
// where <token> encodes the real destination. The only way to recover the
// destination is to issue an HTTP GET (HEAD is not supported by this endpoint
// — it returns 405) with redirect: 'manual' and read the Location header.
//
// Cache: an in-memory Map keyed by the redirect URL avoids paying the HTTP
// cost again within the same process. The token is opaque so the same source
// URL will produce a stable redirect URL across calls.

const VERTEX_REDIRECT_HOST = 'vertexaisearch.cloud.google.com'
const RESOLVE_TIMEOUT_MS = 5000
const vertexResolveCache = new Map<string, string>()

async function resolveOneVertexRedirect(redirectUrl: string): Promise<string | null> {
  const cached = vertexResolveCache.get(redirectUrl)
  if (cached) return cached
  try {
    const res = await safeFetch(redirectUrl, {
      method: 'GET',
      timeout: RESOLVE_TIMEOUT_MS,
      redirect: 'manual',
    })
    // safeFetch follows redirects internally; we want the FINAL URL it landed
    // on (or, if blocked manually, the Location header of the first hop).
    const finalUrl = res.url || res.headers.get('location') || ''
    if (finalUrl && !finalUrl.includes(VERTEX_REDIRECT_HOST)) {
      vertexResolveCache.set(redirectUrl, finalUrl)
      return finalUrl
    }
    return null
  } catch (err) {
    // SSRF / timeout / network — soft-fail. Don't poison the citation list
    // with the unresolved URL, just drop it.
    if (!(err instanceof SsrfError)) {
      logger.warn('Vertex redirect resolution failed', {
        service: 'ai-router',
        redirectUrl: redirectUrl.slice(0, 100),
        err: err instanceof Error ? err.message : String(err),
      })
    }
    return null
  }
}

async function resolveVertexRedirects(uris: string[]): Promise<string[]> {
  // Pass through non-Vertex URLs unchanged; resolve Vertex redirects in
  // parallel for latency. Resolved-to-null is dropped so the dashboard
  // doesn't see the redirect host at all.
  const resolved = await Promise.all(
    uris.map(async (u) => {
      if (!u.includes(VERTEX_REDIRECT_HOST)) return u
      const final = await resolveOneVertexRedirect(u)
      return final
    }),
  )
  return resolved.filter((u): u is string => typeof u === 'string' && u.length > 0)
}

// ─── simulateEngineResponse ────────────────────────────────────────────────────
// Calls the real API for the requested engine. Falls back to Gemini if that
// engine's provider is not configured or fails.

export async function simulateEngineResponse(
  promptText: string,
  engine: MonitoringEngine,
  language: PromptLang = 'en',
  brand?: Brand | null,
): Promise<{
  text: string
  provider: string
  citations?: string[]
  /** Follow-up questions the engine surfaced (currently Perplexity only). */
  relatedQuestions?: string[]
  retrieval: 'live' | 'model-memory'
}> {
  const enginePersona: Record<MonitoringEngine, string> = {
    chatgpt: `You are ChatGPT. Respond in ${LANGUAGE_LABEL[language]} naturally and fluently, as if answering a user from that market. Include relevant brands, products, and services that would be recognized locally.`,
    gemini: `You are Google Gemini. Respond in ${LANGUAGE_LABEL[language]} with well-structured, factual information. Include brands and services relevant to that language's market.`,
    perplexity: `You are Perplexity AI. Respond in ${LANGUAGE_LABEL[language]} with verified facts and local sources where possible.`,
    claude: `You are Claude. Respond in ${LANGUAGE_LABEL[language]} with nuanced analysis and locally relevant brands.`,
  }

  const basePrompt = `${enginePersona[engine]}\n\nUser question: "${promptText}"\n\nProvide a realistic, helpful response (150-300 words).`
  const fullPrompt = enrichPromptWithBrandContext(basePrompt, brand ?? null, {
    includeDomain: true,
    includeAliases: true,
    includeCompetitors: true,
    includeIndustry: true,
  })
  const errors: string[] = []

  if (engine === 'chatgpt' && isOpenAIAvailable()) {
    // Live web search first (real data + citations); plain chat as fallback.
    if (isEngineWebSearchEnabled()) {
      try {
        const { text, citations } = await callOpenAIWithWebSearch(fullPrompt, {
          country: LOCALE_COUNTRY[language],
        })
        if (text) {
          return { text, provider: 'openai:gpt-4o-mini+web', citations, retrieval: 'live' }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        errors.push(`OpenAI (web): ${msg}`)
        logger.warn('OpenAI web search failed, falling back to plain', {
          service: 'ai-router',
          engine,
          error: msg,
        })
      }
    }
    try {
      const text = await callOpenAI(fullPrompt)
      return { text, provider: 'openai:gpt-4o-mini', retrieval: 'model-memory' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`OpenAI: ${msg}`)
      logger.warn('OpenAI call failed', { service: 'ai-router', engine, error: msg })
    }
  }

  if (engine === 'gemini' && isGeminiAvailable()) {
    // Try Google Search grounding first, fall back to plain generate.
    try {
      const { text, citations } = await callGeminiWithSearch(fullPrompt)
      return { text, provider: geminiProviderLabel('search'), citations, retrieval: 'live' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`Gemini (search): ${msg}`)
      logger.warn('Gemini search failed, falling back to plain', {
        service: 'ai-router',
        engine,
        error: msg,
      })
      try {
        const text = await callGeminiFallback(fullPrompt, { model: geminiEngineModel() })
        return { text, provider: geminiProviderLabel('plain'), retrieval: 'model-memory' }
      } catch (e2) {
        errors.push(`Gemini: ${e2 instanceof Error ? e2.message : String(e2)}`)
      }
    }
  }

  if (engine === 'perplexity' && isPerplexityAvailable()) {
    try {
      const { text, citations, relatedQuestions } = await callPerplexityWithCitations(fullPrompt)
      return { text, provider: 'perplexity:sonar', citations, relatedQuestions, retrieval: 'live' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`Perplexity: ${msg}`)
      logger.warn('Perplexity call failed', { service: 'ai-router', engine, error: msg })
    }
  }

  if (engine === 'claude' && isAnthropicAvailable()) {
    // Live web search first (real data + citations); plain message as fallback.
    if (isEngineWebSearchEnabled()) {
      try {
        const { text, citations } = await callAnthropicWithWebSearch(fullPrompt, {
          country: LOCALE_COUNTRY[language],
        })
        if (text) {
          return { text, provider: 'anthropic:claude-sonnet+web', citations, retrieval: 'live' }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        errors.push(`Anthropic (web): ${msg}`)
        logger.warn('Anthropic web search failed, falling back to plain', {
          service: 'ai-router',
          engine,
          error: msg,
        })
      }
    }
    try {
      const text = await callAnthropic(fullPrompt)
      return { text, provider: 'anthropic:claude-sonnet', retrieval: 'model-memory' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`Anthropic: ${msg}`)
      logger.warn('Anthropic call failed', { service: 'ai-router', engine, error: msg })
    }
  }

  // ── Final fallback: any configured provider that has not been tried ────────
  //
  // This used to be Gemini and nothing else, which made every engine depend on
  // one account staying healthy. When Gemini's quota ran out the failure read:
  //
  //   engine "gemini":  Gemini (search) 429 · Gemini 429 · Gemini fallback 429
  //   engine "claude":  Anthropic 400 (no credit) · Gemini fallback 429
  //
  // Three attempts at the same exhausted provider for one engine, and for the
  // other the fallback WAS the exhausted provider — while OpenAI and Perplexity
  // sat configured and untouched. One account's billing took down engines that
  // had nothing to do with it.
  //
  // Falling back across providers is only honest because provenance is now
  // recorded: `response_provider` stores whoever actually answered, so a run
  // served by OpenAI is never counted as a Gemini measurement (migration
  // 20260805090000). Without that column this would be quietly faking data.
  //
  // `engine` is excluded because its own branch above already tried it and
  // pushed its error; retrying it here would just repeat the same failure.
  const fallbacks: Array<{
    id: string
    engine: MonitoringEngine
    available: () => boolean
    call: () => Promise<string>
  }> = [
    {
      id: geminiProviderLabel('plain'),
      engine: 'gemini',
      available: isGeminiAvailable,
      call: () => callGeminiFallback(fullPrompt, { model: geminiEngineModel() }),
    },
    {
      id: 'openai:gpt-4o-mini',
      engine: 'chatgpt',
      available: isOpenAIAvailable,
      call: () => callOpenAI(fullPrompt),
    },
    {
      id: 'perplexity:sonar',
      engine: 'perplexity',
      available: isPerplexityAvailable,
      call: async () => (await callPerplexityWithCitations(fullPrompt)).text,
    },
    {
      id: 'anthropic:claude-sonnet',
      engine: 'claude',
      available: isAnthropicAvailable,
      call: () => callAnthropic(fullPrompt),
    },
  ]

  for (const candidate of fallbacks) {
    if (candidate.engine === engine) continue
    if (!candidate.available()) continue
    try {
      const text = await candidate.call()
      logger.warn('Engine served by a fallback provider', {
        service: 'ai-router',
        requested: engine,
        served: candidate.id,
      })
      return { text, provider: candidate.id, retrieval: 'model-memory' }
    } catch (e) {
      errors.push(`${candidate.id} (fallback): ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  throw new Error(
    `All AI providers failed simulating engine "${engine}":\n` +
      errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n'),
  )
}

// ─── analyzeResponseForBrand ──────────────────────────────────────────────────
// Analyzes a response for brand metrics. Uses Gemini as primary (cheapest
// reasoning), falls back to Claude and ChatGPT.

export async function analyzeResponseForBrand(
  analysisPrompt: string,
): Promise<{ text: string; provider: string }> {
  const errors: string[] = []

  if (isGeminiAvailable()) {
    try {
      // jsonMode disables Gemini 2.5 Flash thinking (the silent budget
      // consumer that was truncating analysis JSON) AND asks for
      // application/json output.
      const text = await callGeminiFallback(analysisPrompt, { jsonMode: true })
      return { text, provider: geminiProviderLabel('plain') }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`Gemini: ${msg}`)
      logger.warn('Gemini failed for analysis', { service: 'ai-router', error: msg })
    }
  }

  if (isAnthropicAvailable()) {
    try {
      const text = await callAnthropic(analysisPrompt)
      return { text, provider: 'anthropic:claude-sonnet' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`Anthropic: ${msg}`)
      logger.warn('Anthropic failed for analysis', { service: 'ai-router', error: msg })
    }
  }

  if (isOpenAIAvailable()) {
    try {
      const text = await callOpenAI(analysisPrompt)
      return { text, provider: 'openai:gpt-4o-mini' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`OpenAI: ${msg}`)
      logger.warn('OpenAI failed for analysis', { service: 'ai-router', error: msg })
    }
  }

  throw new Error(
    'All AI providers failed for brand analysis:\n' +
      errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n'),
  )
}

// ─── getProviderStatus ────────────────────────────────────────────────────────

export function getProviderStatus() {
  return {
    chatgpt: {
      configured: isOpenAIAvailable(),
      bestFor: 'Simulazione ChatGPT / SearchGPT',
      signupUrl: 'https://platform.openai.com',
    },
    gemini: {
      configured: isGeminiAvailable(),
      bestFor: 'Simulazione Gemini + analisi brand (fallback primario)',
      signupUrl: 'https://aistudio.google.com',
    },
    perplexity: {
      configured: isPerplexityAvailable(),
      bestFor: 'Simulazione Perplexity con citazioni',
      signupUrl: 'https://www.perplexity.ai/settings/api',
    },
    claude: {
      configured: isAnthropicAvailable(),
      bestFor: 'Simulazione Claude + analisi ragionata',
      signupUrl: 'https://console.anthropic.com',
    },
  }
}
