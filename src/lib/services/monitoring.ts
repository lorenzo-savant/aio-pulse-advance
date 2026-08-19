// PATH: src/lib/services/monitoring.ts
import { z } from 'zod'
import type {
  MonitoringEngine,
  MonitoringResult,
  Brand,
  Prompt,
  SentimentLabel,
  SentimentAspect,
  MentionType,
  CompetitorMention,
  HallucinationFlag,
  BrandLanguage,
  CitationSource,
} from '@/types'
import type { PromptLang } from '@/lib/prompt-library'

import {
  simulateEngineResponse as routerSimulate,
  analyzeResponseForBrand as routerAnalyze,
} from './ai-router'
import { cleanCitations, groundCitationsViaBrave } from './citation-grounding'
import { detectBrandMention, extractUrlsFromText } from './brand-mention'
import { lexicalSentiment, sentimentAgreement } from './sentiment-lexicon'
import type { LexiconLabel, ConflictLevel } from './sentiment-lexicon'
import { normalizeEntityName } from './competitor-identity'
import { withLlmCache } from './llm-cache'
import { logger } from '@/lib/logger'
import {
  POSITION_SCALE_MAX,
  normalizePositionScore,
  hasMeasuredPosition,
} from '@/lib/metrics/position'

// TTL for the ANALYSIS pass only (see runMonitoringCheck). The simulation
// pass is never persisted — re-running a scan must sample the engine afresh.
//
// Parsed explicitly rather than with `Number(x) || default`: falsy-zero
// coercion made `=0` mean 3600 (so the cache could not be switched off) and
// `=-1` mean 0 (so the documented full-bypass became coalescing-only) —
// exactly inverting the contract llm-cache.ts declares. 0 disables the Redis
// layer, a negative value bypasses every layer.
function parseAnalysisTtl(): number {
  const raw = process.env['AIO_ANALYSIS_CACHE_TTL_SECONDS']
  if (raw === undefined || raw.trim() === '') return 3600
  const n = Number(raw)
  return Number.isFinite(n) ? n : 3600
}

const ANALYSIS_CACHE_TTL_SECONDS = parseAnalysisTtl()

function parseJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
  return JSON.parse(cleaned) as T
}

// ─── Zod schema per validare la risposta AI ───────────────────────────────────
export const analysisOutputSchema = z.object({
  brand_mentioned: z.boolean(),
  mention_position: z.number().int().positive().nullable().optional(),
  mention_count: z.number().int().min(0).default(0),
  mention_type: z.enum(['direct', 'indirect', 'none']).default('none'),
  visibility_score: z.number().min(0).max(100),
  sentiment: z.enum(['positive', 'negative', 'neutral']).default('neutral'),
  sentiment_score: z.number().min(-1).max(1).default(0),
  sentiment_reasoning: z.string().optional().default(''),
  cited_urls: z.array(z.string()).optional().default([]),
  // Bounded, but deliberately NOT filtered against the brand's declared
  // competitor list here. The prompt above asks the model to record look-alikes
  // as competitor mentions on purpose — that is how brand confusion is
  // detected — so discarding unknown names at write time would throw away the
  // signal. Which names count as competitors is decided on READ, by
  // competitor-identity.ts, where the declared list can change without
  // rewriting history.
  //
  // What is enforced here is shape: a name is a short line of text, not an
  // unbounded blob, and one response cannot emit hundreds of rivals.
  competitor_mentions: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        position: z.number().int().nullable().optional(),
        count: z.number().int().nullable().optional().default(1),
      }),
    )
    .max(50)
    .optional()
    .default([]),
  // NOT `.default(false)`. A model returning valid JSON without this key — the
  // commonest LLM omission — used to produce a row recorded as verified clean,
  // indistinguishable from one the model actually assessed. Absent stays absent;
  // the column is nullable, so NULL means "not assessed".
  //
  // Worth stating plainly: this is the ANALYSIS model grading itself, not the
  // fact-checker. `detectHallucinations` is never called by this pipeline.
  has_hallucination: z.boolean().nullable().optional(),
  hallucination_flags: z
    .array(
      z.object({
        text: z.string(),
        severity: z.enum(['low', 'medium', 'high']),
        type: z.enum([
          'factual_error',
          'attribution_error',
          'fabrication',
          'date_error',
          'unsupported_claim',
        ]),
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .optional()
    .default([]),
  // Aspect-based sentiment over a FIXED taxonomy (keeps cross-run aggregation
  // meaningful). preprocess() drops any out-of-taxonomy entry the model emits
  // BEFORE strict validation, so one stray aspect never fails the whole parse.
  sentiment_aspects: z
    .preprocess(
      (val) => {
        if (!Array.isArray(val)) return []
        const ASPECTS = new Set([
          'pricing',
          'quality',
          'support',
          'reliability',
          'usability',
          'features',
          'reputation',
          'value',
        ])
        const SENTS = new Set(['positive', 'negative', 'neutral'])
        return val.filter(
          (v): v is { aspect: string; sentiment: string } =>
            !!v &&
            typeof v === 'object' &&
            ASPECTS.has((v as { aspect?: unknown }).aspect as string) &&
            SENTS.has((v as { sentiment?: unknown }).sentiment as string),
        )
      },
      z.array(
        z.object({
          aspect: z.enum([
            'pricing',
            'quality',
            'support',
            'reliability',
            'usability',
            'features',
            'reputation',
            'value',
          ]),
          sentiment: z.enum(['positive', 'negative', 'neutral']),
        }),
      ),
    )
    .default([]),
})

type AnalysisOutput = z.infer<typeof analysisOutputSchema>

export function buildAnalysisPrompt(
  responseText: string,
  brand: Brand,
  promptText: string,
): string {
  return `You are an AI brand monitoring analyst. Analyze this AI-generated response for mentions and sentiment about the brand "${brand.name}".

BRAND INFO:
- Primary name: ${brand.name}
- Aliases/variants: ${brand.aliases.join(', ') || 'none'}
- Domain: ${brand.domain || 'unknown'}
- Known competitors: ${brand.competitors.join(', ') || 'none'}

ORIGINAL PROMPT/QUERY: "${promptText}"

AI RESPONSE TO ANALYZE:
"""
${responseText.slice(0, 3000)}
"""

EXACT-MATCH RULES — read carefully, these prevent the most common analysis error:
- A "brand mention" requires the EXACT brand name "${brand.name}" or one of its listed aliases to appear as a WHOLE WORD (case-insensitive but otherwise verbatim) in the response. Domain-only matches (e.g. "${brand.domain || brand.name.toLowerCase() + '.com'}") also count.
- Brand names that are SIMILAR but DIFFERENT are NOT mentions. They are distinct companies that happen to share letters. Examples:
    • "${brand.name}" mentioned in response that says "Acasting" → COUNT IT (exact match).
    • "${brand.name}" if the response only mentions "Acast", "cast", or "casting" → DO NOT count it. Acast (podcast platform) is a completely different company from Acasting (casting platform). Treat the look-alike as a competitor_mention if relevant, never as a brand mention.
    • Same principle for any other near-collision: only the exact tokenized name (or a listed alias) counts.
- Substring containment (e.g. "Acasting".includes("Acast")) is a JavaScript trap, not a semantic match. Apply the whole-word rule, not character containment.
- mention_count must count only EXACT occurrences. Each occurrence of "${brand.name}" as a whole word = 1. Synonyms / look-alikes / parent-categories = 0.

SENTIMENT RULE — judge sentiment TOWARD "${brand.name}", not the text's overall mood:
- Favorable to the brand (praised / recommended / ranked best) → positive; warned-against / "scam" / "worst" → negative; factual or absent → neutral with score 0.
- sentiment_score anchors: +1.0 strong praise, +0.4 mild, 0.0 neutral, -0.4 mild criticism, -1.0 strong criticism. Weigh MIXED coverage by balance, not by the last sentence.
- sentiment_aspects: include an entry ONLY for facets of "${brand.name}" the response actually evaluates (skip facets it doesn't touch; empty array if none). Use ONLY the listed aspect keys.

Respond ONLY with a valid JSON object (no markdown, no extra text):
{
  "brand_mentioned": <boolean>,
  "mention_position": <1-based integer position of first mention, or null>,
  "mention_count": <integer>,
  "mention_type": <"direct" | "indirect" | "none">,
  "visibility_score": <integer 0-100>,
  "sentiment": <"positive" | "negative" | "neutral">,
  "sentiment_score": <float -1.0 to 1.0>,
  "sentiment_reasoning": "<one sentence explanation>",
  "sentiment_aspects": [
    {"aspect": <one of: "pricing"|"quality"|"support"|"reliability"|"usability"|"features"|"reputation"|"value">, "sentiment": <"positive"|"negative"|"neutral">}
  ],
  "cited_urls": ["<url>"],
  "competitor_mentions": [
    {"name": "<n>", "position": <1-based index of the SENTENCE in which this competitor first appears, same scale as mention_position; null if unclear>, "count": <integer>}
  ],
  "has_hallucination": <boolean>,
  "hallucination_flags": [
    {
      "text": "<the potentially false claim>",
      "severity": <"low" | "medium" | "high">,
      "type": <"factual_error" (wrong fact) | "attribution_error" (credits wrong source) | "fabrication" (invented entity/quote/source) | "date_error" (wrong date/timeline) | "unsupported_claim" (assertion with no evidence or basis)>,
      "confidence": <float 0.0-1.0 — how confident you are this is a genuine hallucination, not a false positive>
    }
  ]
}`
}

// ─── runMonitoringCheck ───────────────────────────────────────────────────────

export async function runMonitoringCheck(
  prompt: Prompt,
  brand: Brand,
  engine: MonitoringEngine,
  userId: string,
): Promise<Omit<MonitoringResult, 'id' | 'created_at'>> {
  const language: PromptLang =
    (brand.language as BrandLanguage) || (prompt.language as BrandLanguage) || 'en'

  // PASS 1 — engine simulation. This IS the measurement, so it is never
  // persisted to cache (ttl 0): a re-run must sample the engine afresh.
  // The wrapper still coalesces concurrent identical calls, which is the
  // double-spend guard for a double-clicked run or a cron overlapping a
  // manual one — same data, one invoice line.
  const {
    text: responseText,
    provider: simulationProvider,
    citations: engineCitations = [],
    searchQueries: engineSearchQueries,
  } = await withLlmCache(
    {
      surface: 'monitoring',
      engine,
      scope: brand.id,
      payload: { prompt: prompt.text, language },
    },
    () => routerSimulate(prompt.text, engine, language, brand),
  )
  logger.info('Engine simulation completed', {
    service: 'monitoring',
    engine,
    provider: simulationProvider,
  })

  // PASS 2 — analysis of the text produced above. A pure derivation of
  // (responseText, brand, promptText): identical input MUST yield identical
  // output, so it is safe to persist. Different scans produce different
  // responseText and therefore a different key — no false sharing. This
  // halves the LLM spend of a monitoring run on repeated/identical answers.
  const analysisPrompt = buildAnalysisPrompt(responseText, brand, prompt.text)
  const { text: analysisRaw, provider: analysisProvider } = await withLlmCache(
    {
      surface: 'analysis',
      engine,
      scope: brand.id,
      payload: { analysisPrompt },
    },
    () => routerAnalyze(analysisPrompt),
    {
      ttlSeconds: ANALYSIS_CACHE_TTL_SECONDS,
      // Never persist an empty completion — it would poison every retry
      // for the whole TTL and surface as a parse failure downstream.
      shouldCache: (r) => ((r as { text?: string }).text ?? '').trim().length > 0,
    },
  )
  logger.info('Brand analysis completed', {
    service: 'monitoring',
    engine,
    provider: analysisProvider,
  })

  let analysis: AnalysisOutput
  try {
    const rawParsed = parseJson<unknown>(analysisRaw)
    // Zod validates and applies defaults — no field silently undefined
    analysis = analysisOutputSchema.parse(rawParsed)
  } catch (e) {
    // Include raw length so we can immediately tell whether the model
    // returned a truncated response (the historical Gemini 2.5 Flash
    // thinking-budget bug) vs a malformed-but-complete answer. Limit
    // the preview to 500 chars in the error string.
    const errMsg = e instanceof Error ? e.message : String(e)
    throw new Error(
      `Failed to parse/validate analysis response from ${analysisProvider}. ` +
        `Error: ${errMsg}. ` +
        `Raw length: ${analysisRaw.length} chars. ` +
        `Raw: ${analysisRaw.slice(0, 500)}`,
    )
  }

  // ── Two-pass reconciliation (deterministic ground truth) ──────────────────
  // Whether / how often the brand appears, and which URLs the answer contains,
  // are exact-match questions — regex whole-word detection is more reliable
  // than the LLM's prose-rule judgment (it fixes look-alikes like Acast≠Acasting
  // AND the legal-suffix under-count "Savant Media" vs "Savant Media AB") and it
  // never invents URLs. Deterministic wins for those fields; the LLM keeps
  // sentiment / aspects / hallucination / competitors / visibility.
  const det = detectBrandMention(responseText, {
    name: brand.name,
    aliases: brand.aliases,
    domain: brand.domain,
  })

  // Citations: real engine citations + URLs ACTUALLY present in the text (never
  // the LLM's possibly-invented cited_urls). Brave-ground only if empty.
  let citedUrls = cleanCitations([...engineCitations, ...extractUrlsFromText(responseText)])

  // Record WHERE the citations came from. The Brave fallback searches the
  // QUERY, not the response, so those URLs say nothing about whether the engine
  // cited anyone — and citationRate is 20% of the AVI. Unmarked, the score has
  // been measuring Brave's coverage on exactly the rows where the engine cited
  // nothing, which is precisely where it should have scored low.
  let citationSource: CitationSource = 'engine'
  if (citedUrls.length === 0) {
    citedUrls = (await groundCitationsViaBrave(prompt.text, language)).citations
    if (citedUrls.length > 0) citationSource = 'brave_fallback'
  }

  // Second opinion on the sentiment, from the deterministic lexicon. It carries
  // 35% of the AVI once recommendationRate is counted, and until now nothing
  // checked it. A flat contradiction refuses the number rather than correcting
  // it — see resolveSentiment.
  const sentimentReading = resolveSentiment(
    analysis.sentiment as SentimentLabel,
    Math.min(1, Math.max(-1, analysis.sentiment_score)),
    responseText,
  )
  if (sentimentReading.conflict === 'strong') {
    logger.warn('Sentiment refused — lexicon contradicts the model', {
      service: 'monitoring',
      engine,
      brand: brand.name,
      modelLabel: analysis.sentiment,
      modelScore: analysis.sentiment_score,
    })
  }

  // Keep visibility consistent with the deterministic mention: if the brand IS
  // mentioned but the model scored 0, floor it so the row isn't self-contradictory.
  let visibility = Math.min(100, Math.max(0, analysis.visibility_score))
  if (det.brandMentioned && visibility === 0) visibility = 20

  return {
    prompt_id: prompt.id,
    brand_id: brand.id,
    user_id: userId,
    engine,
    prompt_text: prompt.text || 'No prompt text',
    response_text: responseText.length > 5000 ? responseText.slice(0, 5000) + '…' : responseText,
    brand_mentioned: det.brandMentioned,
    mention_position: det.mentionPosition,
    mention_count: det.mentionCount,
    mention_type: det.mentionType as MentionType,
    visibility_score: visibility,
    sentiment: analysis.sentiment as SentimentLabel,
    sentiment_score: sentimentReading.score,
    sentiment_aspects: analysis.sentiment_aspects as SentimentAspect[],
    cited_urls: citedUrls,
    competitor_mentions: analysis.competitor_mentions as CompetitorMention[],
    // `?? null` rather than `?? false`: an omitted key means the model did not
    // assess it, and the column is nullable so we can say so.
    has_hallucination: analysis.has_hallucination ?? null,
    hallucination_flags: analysis.hallucination_flags as HallucinationFlag[],
    // `engine` above is what was REQUESTED. This is what answered, after any
    // router fallback — the two differ whenever a provider is unconfigured or
    // errors, and the per-engine comparison in the reports depends on knowing
    // which is which.
    response_provider: simulationProvider ?? null,
    citation_source: citationSource,
    // Query fan-out: the searches the engine actually ran. `?? null` is
    // load-bearing — undefined means the provider does not expose its queries
    // (Perplexity) and must stay NULL, distinct from an empty array, which
    // means the engine answered without searching. Collapsing the two would
    // turn "we cannot see it" into "it did not happen". See fan-out.ts.
    search_queries: engineSearchQueries ?? null,
  }
}

// ─── analyzeSentiment ─────────────────────────────────────────────────────────

export interface SentimentResult {
  sentiment: SentimentLabel
  score: number
  confidence: number
  reasoning: string
  aspects: Array<{ aspect: string; sentiment: SentimentLabel; explanation: string }>
  /** Deterministic lexicon cross-check (see sentiment-lexicon.ts). Present
   *  when a reading was available; lets the UI flag low-agreement verdicts. */
  lexicalCheck?: {
    label: LexiconLabel
    score: number
    hits: number
    conflict: ConflictLevel
  }
}

export async function analyzeSentiment(text: string, brandName: string): Promise<SentimentResult> {
  const prompt = `You are a brand-sentiment analyst. Judge the sentiment expressed TOWARD the brand "${brandName}" — not the overall mood of the text. If the brand is described favorably while a competitor is criticized, that is POSITIVE for "${brandName}".

TEXT:
"""
${text.slice(0, 4000)}
"""

SCORING RUBRIC (score is a float -1.0 … 1.0):
- +1.0 strongly positive (praised, recommended, "best") · +0.4 mildly positive
-  0.0 neutral / factual mention with no evaluation · brand absent → neutral, score 0
- -0.4 mildly negative · -1.0 strongly negative (warned against, "scam", "worst")
- MIXED: weigh the balance and explain it; do not just pick the last sentence.
- confidence reflects how clearly the text evaluates the brand (0 = ambiguous/absent, 100 = explicit).

Respond ONLY with valid JSON (no markdown):
{
  "sentiment": <"positive" | "negative" | "neutral">,
  "score": <float -1.0 to 1.0>,
  "confidence": <integer 0-100>,
  "reasoning": "<one paragraph explanation>",
  "aspects": [
    {
      "aspect": "<aspect of the brand: pricing, support, quality, reliability, …>",
      "sentiment": <"positive" | "negative" | "neutral">,
      "explanation": "<brief reason>"
    }
  ]
}`

  const { text: raw, provider } = await routerAnalyze(prompt)
  logger.info('Sentiment analysis completed', { service: 'monitoring', provider })
  const result = parseJson<SentimentResult>(raw)

  // Deterministic cross-check: a free second opinion over the LLM. On a strong
  // polar conflict, cap confidence so the UI doesn't present a shaky verdict as
  // certain. The LLM label is never overridden — the lexicon is too coarse for
  // that — only its certainty is tempered.
  const lex = lexicalSentiment(text)
  const { conflict } = sentimentAgreement(result.sentiment as LexiconLabel, lex)
  result.lexicalCheck = { label: lex.label, score: lex.score, hits: lex.hits, conflict }
  if (conflict === 'strong' && typeof result.confidence === 'number') {
    result.confidence = Math.min(result.confidence, 40)
  }
  return result
}

// ─── detectHallucinations ─────────────────────────────────────────────────────

export interface HallucinationResult {
  has_hallucination: boolean
  confidence: number
  flags: HallucinationFlag[]
  summary: string
}

export async function detectHallucinations(
  aiResponse: string,
  brandName: string,
  knownFacts: string[],
): Promise<HallucinationResult> {
  const factsBlock =
    knownFacts.length > 0
      ? `Known facts about ${brandName}:\n${knownFacts.map((f) => `- ${f}`).join('\n')}`
      : `No specific facts provided. Flag any claims that seem suspicious or unverifiable.`

  const prompt = `You are a fact-checking AI. Analyze this AI-generated response for potential hallucinations or factual errors about "${brandName}".

${factsBlock}

AI RESPONSE:
"""
${aiResponse.slice(0, 4000)}
"""

Respond ONLY with valid JSON (no markdown):
{
  "has_hallucination": <boolean>,
  "confidence": <integer 0-100>,
  "flags": [
    {
      "text": "<exact claim that may be false>",
      "severity": <"low" | "medium" | "high">,
      "type": <"factual_error" | "attribution_error" | "fabrication" | "date_error" | "unsupported_claim">,
      "confidence": <float 0.0-1.0 for this specific flag>
    }
  ],
  "summary": "<one paragraph overall assessment>"
}`

  const { text: raw, provider } = await routerAnalyze(prompt)
  logger.info('Hallucination detection completed', { service: 'monitoring', provider })
  return parseJson<HallucinationResult>(raw)
}

// ─── AVI Formula ─────────────────────────────────────────────────────────────

/**
 * How warm an answer must be about the brand before it counts as a
 * recommendation rather than a mention.
 *
 * Above zero on purpose: "not negative" is not an endorsement, and being listed
 * neutrally among ten competitors should not score as one. Exported so a report
 * can state the rule it is claiming.
 */
export const POSITIVE_SENTIMENT_THRESHOLD = 0.25

/**
 * Every component may be null, and null always means the same thing: nothing
 * measured it. A null component drops out of the score and its weight is shared
 * by the ones that were measured, so absence never stands in as a midpoint.
 */
export interface AVIInput {
  citationRate: number
  mentionFrequency: number
  /** null when no mention carried a usable sentiment reading. */
  sentimentScore: number | null
  /** null when no mention could be classified as recommended or not. */
  recommendationRate: number | null
  /** 0 is the "never positioned" sentinel the cron writes. */
  positionAvg: number
  /** null when no result in the set carried an assessment. */
  hallucinationIndex: number | null
}

/**
 * `mention_position` is a SENTENCE INDEX, not a list rank.
 * `brand-mention.ts` → `sentenceIndexOf` counts sentence terminators and caps
 * at 20, so 1 is the opening sentence and 20 means "late, or later".
 *
 * The formula used to normalise it as `((5 - p) / 4) * 100`, i.e. a 1-5 rank.
 * Everything from the fifth sentence on therefore scored exactly zero — a cliff
 * in the middle of a perfectly normal prose answer.
 *
 * Re-exported from lib/metrics/position, which is now the single definition.
 * Fixing it here in 1a1e10d left the old formula in three other places, so the
 * constant and the normalisation moved somewhere every scorer — server and
 * client — can reach.
 */
export { POSITION_SCALE_MAX }

/**
 * Reconciles the model's sentiment against the deterministic lexicon.
 *
 * The lexicon (`sentiment-lexicon.ts`) is trilingual, tested, and was already
 * imported here — but only `analyzeSentiment` used it, and only
 * `/api/sentiment` calls that. The pipeline that writes the database scored
 * sentiment with no second opinion at all, which matters more than it looks:
 * after the recommendation fix, sentiment drives 35% of the AVI (15% directly,
 * 20% through `recommendationRate`).
 *
 * `sentimentAgreement` reports `strong` only for OPPOSITE polarity with at least
 * two lexicon hits. On that, the score is refused rather than corrected — the
 * claim is not "the model is wrong", it is "these two disagree flatly, so
 * nothing here is measured well enough to put in a score". A null score drops
 * the component out of the AVI instead of standing in as neutral.
 *
 * The label is left as the model reported it: it is descriptive, and readers can
 * see it. The number is what enters the arithmetic, and that is what gets held
 * to a higher bar.
 */
export function resolveSentiment(
  label: SentimentLabel,
  score: number,
  responseText: string,
): { score: number | null; conflict: ConflictLevel } {
  const lex = lexicalSentiment(responseText)
  const { conflict } = sentimentAgreement(label as LexiconLabel, lex)

  return { score: conflict === 'strong' ? null : score, conflict }
}

export function calculateAVI(input: AVIInput): number {
  const {
    citationRate,
    mentionFrequency,
    sentimentScore,
    recommendationRate,
    positionAvg,
    hallucinationIndex,
  } = input
  // One rule for every component: a null contributes nothing and claims no
  // weight, so the score is always "of what was actually measured". Absence is
  // never a midpoint, and never a verdict.
  //
  // `positionAvg <= 0` is the "never positioned" sentinel the cron writes; it
  // used to normalise to a fabricated 50, which made an unmeasured position
  // score better than a measured late one.
  const parts: Array<{ value: number; weight: number }> = [
    { value: citationRate, weight: 0.2 },
    { value: mentionFrequency, weight: 0.2 },
  ]

  if (sentimentScore != null) {
    parts.push({
      value: ((Math.max(-1, Math.min(1, sentimentScore)) + 1) / 2) * 100,
      weight: 0.15,
    })
  }
  if (recommendationRate != null) {
    parts.push({ value: recommendationRate, weight: 0.2 })
  }
  if (hasMeasuredPosition(positionAvg)) {
    parts.push({ value: normalizePositionScore(positionAvg), weight: 0.15 })
  }
  if (hallucinationIndex != null) {
    parts.push({ value: Math.max(0, 100 - hallucinationIndex), weight: 0.1 })
  }

  const weight = parts.reduce((sum, p) => sum + p.weight, 0)
  if (weight === 0) return 0

  const raw = parts.reduce((sum, p) => sum + p.value * p.weight, 0)
  return Math.min(100, Math.max(0, Math.round((raw / weight) * 10) / 10))
}

export function calculateAVIFromResults(
  results: Array<{
    brand_mentioned: boolean
    visibility_score: number
    sentiment_score: number | null
    cited_urls: string[]
    /** null when nothing assessed this result. */
    has_hallucination: boolean | null
    mention_position?: number | null
    /**
     * Where cited_urls came from. Absent on rows written before the column
     * existed, and those keep counting as they always did — reinterpreting the
     * archive downwards would put a step in every chart that no change in the
     * world caused.
     */
    citation_source?: CitationSource | null
  }>,
): { avi: number; components: AVIInput } {
  const total = results.length
  if (total === 0)
    return {
      avi: 0,
      components: {
        citationRate: 0,
        mentionFrequency: 0,
        sentimentScore: 0,
        recommendationRate: 0,
        positionAvg: 0,
        hallucinationIndex: 0,
      },
    }

  const mentioned = results.filter((r) => r.brand_mentioned)

  // No mention anywhere means there is no AI visibility to index. Every
  // mention-derived component is 0 and the rest have no referent — sentiment,
  // position and hallucination are all judgements ABOUT a mention. Scoring them
  // as midpoints produced a floor of exactly 25.0/100 for a brand no engine had
  // ever named, printed on report covers as if something had been measured.
  if (mentioned.length === 0) {
    return {
      avi: 0,
      components: {
        citationRate: 0,
        mentionFrequency: 0,
        sentimentScore: 0,
        recommendationRate: 0,
        positionAvg: 0,
        hallucinationIndex: 0,
      },
    }
  }
  // A recommendation is a mention the answer speaks well of. This used to be
  // `mentioned` again — byte-identical to mentionFrequency on the line below —
  // so the AVI declared six components but carried five signals, and mention
  // frequency drove 40% of the score under two names.
  // A disputed reading (see resolveSentiment) is stored as null. It cannot be
  // classified as recommended or not, so it is excluded from the signal rather
  // than counted as "not recommended" — which would be a verdict.
  const mentionedWithSentiment = mentioned.filter((r) => r.sentiment_score != null)
  const recommended = mentionedWithSentiment.filter(
    (r) => (r.sentiment_score ?? 0) >= POSITIVE_SENTIMENT_THRESHOLD,
  )
  // citationRate answers "how often does an engine cite sources when it answers
  // about this brand". The Brave fallback fires precisely when the engine cited
  // nothing, and searches the QUERY rather than the response — counting it
  // inverted the signal on exactly the rows being measured.
  const cited = results.filter(
    (r) => r.cited_urls && r.cited_urls.length > 0 && r.citation_source !== 'brave_fallback',
  )
  // The index is a rate over results that were ASSESSED. Counting unassessed
  // rows in the denominator dilutes it toward zero, which reads as "cleaner"
  // exactly when less checking happened.
  const assessedForHallucination = results.filter((r) => r.has_hallucination != null)
  const hallucinated = assessedForHallucination.filter((r) => r.has_hallucination)
  const positionsValid = mentioned
    .map((r) => r.mention_position)
    .filter((p): p is number => p != null && p > 0)

  const components: AVIInput = {
    citationRate: (cited.length / total) * 100,
    mentionFrequency: (mentioned.length / total) * 100,
    sentimentScore:
      mentionedWithSentiment.length > 0
        ? mentionedWithSentiment.reduce((a, r) => a + (r.sentiment_score ?? 0), 0) /
          mentionedWithSentiment.length
        : null,
    // Denominator stays `total` so this remains comparable with
    // mentionFrequency; it is null only when nothing could be classified at all.
    recommendationRate:
      mentionedWithSentiment.length > 0 ? (recommended.length / total) * 100 : null,
    positionAvg:
      positionsValid.length > 0
        ? positionsValid.reduce((a, p) => a + p, 0) / positionsValid.length
        : 0,
    hallucinationIndex:
      assessedForHallucination.length > 0
        ? (hallucinated.length / assessedForHallucination.length) * 100
        : null,
  }
  return { avi: calculateAVI(components), components }
}

// ─── calculateCompetitorAVI ───────────────────────────────────────────────────

export interface CompetitorGapResult {
  rank: number
  weakestComponent: string
  competitorAvi: number
}

const COMPONENT_WEIGHTS: Record<keyof AVIInput, number> = {
  citationRate: 0.2,
  mentionFrequency: 0.2,
  sentimentScore: 0.15,
  recommendationRate: 0.2,
  positionAvg: 0.15,
  hallucinationIndex: 0.1,
}

const COMPONENT_LABELS: Record<keyof AVIInput, string> = {
  citationRate: 'Citation Rate',
  mentionFrequency: 'Mention Frequency',
  sentimentScore: 'Sentiment Score',
  recommendationRate: 'Recommendation Rate',
  positionAvg: 'Position Average',
  hallucinationIndex: 'Hallucination Index',
}

/**
 * What we can actually measure about a competitor.
 *
 * A competitor is only ever observed through mentions inside answers about the
 * brand. There is no sentiment analysis of them, no citation data for them, no
 * hallucination check on them — so an "AVI" for a competitor cannot be built
 * from the same six components as the brand's, and the two numbers are not on
 * the same scale. `calculateCompetitorAVI` below builds one anyway by
 * substituting `sentimentScore: 0` (a literal, not a measurement),
 * `hallucinationIndex: 0`, and `citationRate: min(100, mentions * 10)` — a
 * rescaled count with no denominator. Subtracting that from the brand's AVI
 * inflates every gap it prints.
 *
 * These three numbers are measured, comparable and mean what their names say.
 */
export interface CompetitorStandings {
  name: string
  /** Total weighted mentions across the window. */
  mentions: number
  /** Share of all competitor mentions in the same window, 0–100. */
  shareOfCompetitorMentions: number
  /**
   * Mean of the `position` values the model reported, when it reported any.
   *
   * Treat with care and do NOT show it to a client as a ranking. Until
   * 2026-08-05 the prompt asked for `"position": <integer>` with no definition
   * whatsoever — not the unit, not the origin — so historical rows hold
   * whatever each model decided that meant: a sentence index, a place in a
   * list, an offset. The prompt now pins it to a 1-based sentence index, which
   * makes rows written from here on comparable; rows written before are not
   * comparable with them or with each other.
   */
  avgPosition: number | null
}

export function calculateCompetitorStandings(
  competitorMentions: Array<{ name: string; position: number; count: number }>,
  totalCompetitorMentions: number,
): CompetitorStandings | null {
  const mentions = competitorMentions.reduce((sum, m) => sum + Math.max(m.count, 0), 0)
  if (mentions === 0) return null

  const positioned = competitorMentions.filter((m) => m.position > 0)

  return {
    name: competitorMentions[0]?.name ?? '',
    mentions,
    shareOfCompetitorMentions:
      totalCompetitorMentions > 0
        ? Math.round((mentions / totalCompetitorMentions) * 1000) / 10
        : 0,
    avgPosition:
      positioned.length > 0
        ? Math.round(
            (positioned.reduce((sum, m) => sum + m.position, 0) / positioned.length) * 10,
          ) / 10
        : null,
  }
}

/**
 * One row of the competitor table in the HTML report: measured, comparable and
 * meaningful under its own name. This is the shape the report now prints —
 * `name / mentions / shareOfCompetitorMentions / avgPosition`.
 *
 * Only DECLARED competitors get a row. A name the model invented is still
 * counted in the denominator (so shares add up honestly) but is never
 * presented to the client as a rival with a standing. A declared competitor
 * that was never mentioned gets `hasData: false` — "not mentioned" is not
 * "scores zero", and must never look like a 0/100 standing against the brand.
 */
export interface CompetitorReportRow {
  name: string
  mentions: number
  share: number | null
  avgPosition: number | null
  hasData: boolean
}

export function buildCompetitorReport(
  declaredCompetitors: string[],
  allMentions: CompetitorMention[],
): CompetitorReportRow[] {
  const totalCompetitorMentions = allMentions.reduce((sum, m) => sum + Math.max(m.count ?? 1, 0), 0)

  return declaredCompetitors.map((compName) => {
    const compMentions = allMentions.filter(
      (m) => normalizeEntityName(m.name ?? '') === normalizeEntityName(compName),
    )
    const standings = calculateCompetitorStandings(compMentions, totalCompetitorMentions)

    return {
      name: compName,
      mentions: standings?.mentions ?? 0,
      share: standings?.shareOfCompetitorMentions ?? null,
      avgPosition: standings?.avgPosition ?? null,
      hasData: standings !== null,
    }
  })
}

/**
 * @deprecated Not comparable to the brand's AVI — see CompetitorStandings.
 * Retained because it is still covered by competitor-gap.test.ts and
 * html-report.test.ts, which pin its current arithmetic. New report surfaces
 * use calculateCompetitorStandings.
 */
export function calculateCompetitorAVI(
  competitorMentions: Array<{ name: string; position: number; count: number }>,
  brandAVI: number,
): CompetitorGapResult {
  const totalMentions = competitorMentions.reduce((sum, m) => sum + m.count, 0)

  if (totalMentions === 0) {
    return {
      rank: 0,
      weakestComponent: 'mentionFrequency',
      competitorAvi: 0,
    }
  }

  const mentioned = competitorMentions.filter((m) => m.count > 0)
  const positionsValid = competitorMentions.filter((m) => m.position > 0)

  const components: AVIInput = {
    citationRate: Math.min(100, totalMentions * 10),
    mentionFrequency: Math.min(
      100,
      (mentioned.length / Math.max(1, competitorMentions.length)) * 100,
    ),
    sentimentScore: 0,
    recommendationRate: Math.min(
      100,
      (mentioned.length / Math.max(1, competitorMentions.length)) * 100,
    ),
    positionAvg:
      positionsValid.length > 0
        ? positionsValid.reduce((sum, m) => sum + m.position, 0) / positionsValid.length
        : 5,
    hallucinationIndex: 0,
  }

  const competitorAvi = calculateAVI(components)

  const rank = competitorAvi >= brandAVI ? 1 : brandAVI - competitorAvi > 20 ? 3 : 2

  const componentValues: Array<{ key: keyof AVIInput; value: number }> = [
    { key: 'citationRate', value: components.citationRate * COMPONENT_WEIGHTS.citationRate },
    {
      key: 'mentionFrequency',
      value: components.mentionFrequency * COMPONENT_WEIGHTS.mentionFrequency,
    },
    // Infinity for an unmeasured component: nothing that was never measured can
    // be the "weakest" one, and the report must not tell a client to fix it.
    {
      key: 'sentimentScore',
      value:
        components.sentimentScore == null
          ? Number.POSITIVE_INFINITY
          : ((components.sentimentScore + 1) / 2) * 100 * COMPONENT_WEIGHTS.sentimentScore,
    },
    {
      key: 'recommendationRate',
      value:
        components.recommendationRate == null
          ? Number.POSITIVE_INFINITY
          : components.recommendationRate * COMPONENT_WEIGHTS.recommendationRate,
    },
    // Was `((5 - positionAvg) / 4) * 100` — the 1-5 rank formula commit 1a1e10d
    // declared wrong — AND returned 0 for the never-positioned sentinel while
    // every other component here returns POSITIVE_INFINITY for absence. Both
    // pushed this branch toward winning: unmeasured scored 0 outright, and any
    // position past the fifth sentence scored 0 too. The result was that
    // "Answer Position" was reported as the weakest component in very nearly
    // every competitor report, whatever the brand actually looked like.
    {
      key: 'positionAvg',
      value: hasMeasuredPosition(components.positionAvg)
        ? normalizePositionScore(components.positionAvg) * COMPONENT_WEIGHTS.positionAvg
        : Number.POSITIVE_INFINITY,
    },
    // An unassessed index contributes nothing, so it can never be reported as
    // the weakest component — there is no measurement to call weak.
    {
      key: 'hallucinationIndex',
      value:
        components.hallucinationIndex == null
          ? Number.POSITIVE_INFINITY
          : (100 - components.hallucinationIndex) * COMPONENT_WEIGHTS.hallucinationIndex,
    },
  ]

  if (componentValues.length === 0) {
    return {
      rank,
      weakestComponent: 'Citation Rate',
      competitorAvi,
    }
  }

  let weakest = componentValues[0]!
  for (const curr of componentValues) {
    if (curr.value < weakest.value) {
      weakest = curr
    }
  }

  return {
    rank,
    weakestComponent: COMPONENT_LABELS[weakest.key],
    competitorAvi,
  }
}

// ─── Sentiment Heatmap ───────────────────────────────────────────────────────

export type HeatmapCell = {
  sentiment: number
  mentions: number
  avi: number
}

export type HeatmapRow = Record<string, HeatmapCell>

export type SentimentHeatmap = Record<string, HeatmapRow>

export function buildSentimentHeatmap(
  results: Array<{
    engine: string
    category: string | null
    brand_mentioned: boolean
    sentiment_score: number | null
    visibility_score: number
    cited_urls: string[]
    /** null when nothing assessed this result. */
    has_hallucination: boolean | null
    mention_position?: number | null
  }>,
): SentimentHeatmap {
  const heatmap: SentimentHeatmap = {}

  const grouped = results.reduce(
    (acc, r) => {
      const category = r.category ?? 'uncategorized'
      const key = `${r.engine}:${category}`
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(r)
      return acc
    },
    {} as Record<string, typeof results>,
  )

  for (const [key, groupResults] of Object.entries(grouped)) {
    const [engine, category] = key.split(':') as [string, string]

    const mentioned = groupResults.filter((r) => r.brand_mentioned)
    const sentimentSum = mentioned.reduce((a, r) => a + (r.sentiment_score ?? 0), 0)
    const avgSentiment = mentioned.length > 0 ? sentimentSum / mentioned.length : 0

    const { avi } = calculateAVIFromResults(groupResults)

    if (!heatmap[engine]) {
      heatmap[engine] = {}
    }
    heatmap[engine][category] = {
      sentiment: Math.round(avgSentiment * 1000) / 1000,
      mentions: mentioned.length,
      avi: Math.round(avi * 10) / 10,
    }
  }

  return heatmap
}

// ─── calculateHealthScore ─────────────────────────────────────────────────────

/** @deprecated Use calculateAVI() instead. Backward-compatible wrapper. */
export function calculateHealthScore(
  visibilityScore: number,
  sentimentScore: number,
  hallucinationRate: number,
): number {
  return calculateAVI({
    citationRate: visibilityScore,
    mentionFrequency: visibilityScore,
    sentimentScore,
    recommendationRate: visibilityScore,
    positionAvg: 0,
    hallucinationIndex: hallucinationRate * 100,
  })
}

// ─── Domain SOAIV (Share of AI Voice) ────────────────────────────────────────

export interface DomainSOAIVResult {
  domain: string
  brandShare: number
  competitorShare: number
  otherShare: number
}

function normalizeDomain(domain: string): string {
  return domain.replace(/^www\./, '').toLowerCase()
}

function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export function calculateDomainSOAIV(
  citedUrls: string[],
  brandDomain: string,
  competitors: string[],
): DomainSOAIVResult[] {
  const normalizedBrandDomain = normalizeDomain(brandDomain)
  const normalizedCompetitors = competitors.map(normalizeDomain)

  const categoryCounts: Record<string, { brand: number; competitor: number; other: number }> = {}

  for (const url of citedUrls) {
    const hostname = extractHostname(url)
    if (!hostname) continue

    const normalized = normalizeDomain(hostname)

    let category: 'brand' | 'competitor' | 'other'
    if (normalized === normalizedBrandDomain || normalized.endsWith(`.${normalizedBrandDomain}`)) {
      category = 'brand'
    } else if (
      normalizedCompetitors.some((c) => normalized === c || normalized.endsWith(`.${c}`))
    ) {
      category = 'competitor'
    } else {
      category = 'other'
    }

    const domainKey = normalizedCompetitors.some((c) => normalized.endsWith(`.${c}`))
      ? normalizedCompetitors.find((c) => normalized.endsWith(`.${c}`))!
      : normalized

    if (!categoryCounts[domainKey]) {
      categoryCounts[domainKey] = { brand: 0, competitor: 0, other: 0 }
    }
    categoryCounts[domainKey][category]++
  }

  const results: DomainSOAIVResult[] = []
  for (const [domain, counts] of Object.entries(categoryCounts)) {
    const total = counts.brand + counts.competitor + counts.other
    if (total === 0) continue
    results.push({
      domain,
      brandShare: Math.round((counts.brand / total) * 1000) / 10,
      competitorShare: Math.round((counts.competitor / total) * 1000) / 10,
      otherShare: Math.round((counts.other / total) * 1000) / 10,
    })
  }

  return results.sort((a, b) => b.brandShare - a.brandShare)
}

// ─── generateRecommendations ─────────────────────────────────────────────────

export interface RecommendationInput {
  aviComponents: AVIInput
  soaiv: DomainSOAIVResult[]
  competitorGap: {
    rank: number
    competitorAvi: number
    brandAvi: number
    weakestComponent: string
  }
}

export interface Recommendation {
  priority: number
  title: string
  description: string
  impact: number
  effort: number
  component: string
}

const RECOMMENDATION_RULES: Array<{
  condition: (input: RecommendationInput) => boolean
  title: string
  description: (input: RecommendationInput) => string
  impact: number
  effort: number
  component: string
}> = [
  {
    condition: (i) => i.aviComponents.citationRate < 30,
    title: 'Aumenta citazioni',
    description: () =>
      'Il tasso di citazione è basso. Pubblica contenuti che attirino più link da siti autorevoli.',
    impact: 8,
    effort: 5,
    component: 'citationRate',
  },
  {
    condition: (i) => i.aviComponents.mentionFrequency < 40,
    title: 'Aumenta visibilità',
    description: () =>
      'La frequenza di mention è bassa. Incrementa la presenza del brand nei risultati di ricerca.',
    impact: 7,
    effort: 4,
    component: 'mentionFrequency',
  },
  {
    // Never advise on a reading that does not exist: null must not satisfy any
    // of these thresholds.
    condition: (i) => (i.aviComponents.sentimentScore ?? 0) < 0,
    title: 'Migliora sentiment',
    description: () =>
      'Il sentiment medio è negativo. Affronta le recensioni negative e rafforza la comunicazione positiva.',
    impact: 7,
    effort: 3,
    component: 'sentimentScore',
  },
  {
    condition: (i) =>
      i.aviComponents.sentimentScore != null &&
      i.aviComponents.sentimentScore >= 0 &&
      i.aviComponents.sentimentScore < 0.5,
    title: 'Incrementa sentiment positivo',
    description: () =>
      'Il sentiment è neutra. Amplifica i messaggi positivi per migliorare la percezione del brand.',
    impact: 5,
    effort: 3,
    component: 'sentimentScore',
  },
  {
    condition: (i) =>
      i.aviComponents.recommendationRate != null && i.aviComponents.recommendationRate < 30,
    title: 'Aumenta raccomandazioni',
    description: () =>
      'Tasso di raccomandazione basso. Crea contenuti che generino endorsement organici.',
    impact: 7,
    effort: 5,
    component: 'recommendationRate',
  },
  {
    condition: (i) => i.aviComponents.positionAvg > 3,
    title: 'Migliora posizionamento',
    description: () =>
      'La posizione media nei risultati è bassa. Ottimizza SEO e content strategy per salire nelle SERP.',
    impact: 6,
    effort: 6,
    component: 'positionAvg',
  },
  {
    // Never recommend fixing hallucinations off an index nobody measured.
    condition: (i) => (i.aviComponents.hallucinationIndex ?? 0) > 20,
    title: 'Riduci allucinazioni',
    description: () =>
      'Alto indice di allucinazioni. Verifica e correggi le informazioni generate inaccurate.',
    impact: 6,
    effort: 4,
    component: 'hallucinationIndex',
  },
  {
    condition: (i) =>
      i.competitorGap && i.competitorGap.brandAvi - i.competitorGap.competitorAvi > 20,
    title: 'Recupera gap competitor',
    description: (i) =>
      `Il competitor è dominante nel componente: ${i.competitorGap.weakestComponent}. Analizza le strategie del competitor e implementa azioni correttive.`,
    impact: 9,
    effort: 7,
    component: 'competitorGap',
  },
  {
    condition: (i) => i.soaiv.length > 0 && i.soaiv[0]!.brandShare < 40,
    title: 'Aumenta share del brand',
    description: (i) =>
      `La quota del brand nelle citazioni è bassa (${i.soaiv[0]!.brandShare}%). Diversifica le fonti e aumenta la visibilità su domini terzi.`,
    impact: 7,
    effort: 6,
    component: 'soaiv',
  },
  {
    condition: (i) => {
      const competitorShare = i.soaiv.find((d) => d.competitorShare > d.brandShare)
      return !!competitorShare
    },
    title: 'Combatti dominio competitor',
    description: () =>
      'Un competitor sta dominando nelle citazioni. Identifica i domini che citano il competitor e propogli contenuti alternativi.',
    impact: 8,
    effort: 6,
    component: 'soaiv',
  },
]

export function generateRecommendations(input: RecommendationInput): Recommendation[] {
  const recommendations: Recommendation[] = []

  for (const rule of RECOMMENDATION_RULES) {
    if (rule.condition(input)) {
      const priority = rule.impact * 3 - rule.effort
      recommendations.push({
        priority,
        title: rule.title,
        description: rule.description(input),
        impact: rule.impact,
        effort: rule.effort,
        component: rule.component,
      })
    }
  }

  return recommendations.sort((a, b) => b.priority - a.priority)
}
