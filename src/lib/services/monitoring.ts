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
import { withLlmCache } from './llm-cache'
import { logger } from '@/lib/logger'

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
  competitor_mentions: z
    .array(
      z.object({
        name: z.string(),
        position: z.number().int().nullable().optional(),
        count: z.number().int().nullable().optional().default(1),
      }),
    )
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
    {"name": "<n>", "position": <integer>, "count": <integer>}
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
  if (citedUrls.length === 0) {
    citedUrls = (await groundCitationsViaBrave(prompt.text, language)).citations
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
    sentiment_score: Math.min(1, Math.max(-1, analysis.sentiment_score)),
    sentiment_aspects: analysis.sentiment_aspects as SentimentAspect[],
    cited_urls: citedUrls,
    competitor_mentions: analysis.competitor_mentions as CompetitorMention[],
    // `?? null` rather than `?? false`: an omitted key means the model did not
    // assess it, and the column is nullable so we can say so.
    has_hallucination: analysis.has_hallucination ?? null,
    hallucination_flags: analysis.hallucination_flags as HallucinationFlag[],
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

export interface AVIInput {
  citationRate: number
  mentionFrequency: number
  sentimentScore: number
  recommendationRate: number
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
 */
export const POSITION_SCALE_MAX = 20

export function calculateAVI(input: AVIInput): number {
  const {
    citationRate,
    mentionFrequency,
    sentimentScore,
    recommendationRate,
    positionAvg,
    hallucinationIndex,
  } = input
  const sentimentNorm = ((Math.max(-1, Math.min(1, sentimentScore)) + 1) / 2) * 100

  // A hallucination index of null means nothing assessed it — which is not the
  // same as assessing it and finding none. Treated like an absent position: the
  // component drops out rather than awarding its full 10 points by default.
  const hasHallucination = hallucinationIndex != null
  const antiHallucination = hasHallucination ? Math.max(0, 100 - hallucinationIndex) : 0

  // `positionAvg <= 0` is the "never positioned" sentinel the cron writes. It
  // used to normalise to 50 — a fabricated midpoint that made an unmeasured
  // position score better than a measured late one. Absence is not a verdict:
  // the component drops out and its weight is shared by what WAS measured, so
  // a missing reading lands between the best and worst real ones instead of at
  // an invented middle.
  const hasPosition = positionAvg > 0
  const positionNorm = hasPosition
    ? Math.max(
        0,
        Math.min(100, ((POSITION_SCALE_MAX - positionAvg) / (POSITION_SCALE_MAX - 1)) * 100),
      )
    : 0

  let raw =
    citationRate * 0.2 + mentionFrequency * 0.2 + sentimentNorm * 0.15 + recommendationRate * 0.2
  let weight = 0.75

  if (hasPosition) {
    raw += positionNorm * 0.15
    weight += 0.15
  }
  if (hasHallucination) {
    raw += antiHallucination * 0.1
    weight += 0.1
  }

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
  const recommended = mentioned.filter(
    (r) => (r.sentiment_score ?? 0) >= POSITIVE_SENTIMENT_THRESHOLD,
  )
  const cited = results.filter((r) => r.cited_urls && r.cited_urls.length > 0)
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
      mentioned.length > 0
        ? mentioned.reduce((a, r) => a + (r.sentiment_score ?? 0), 0) / mentioned.length
        : 0,
    recommendationRate: (recommended.length / total) * 100,
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
    {
      key: 'sentimentScore',
      value: ((components.sentimentScore + 1) / 2) * 100 * COMPONENT_WEIGHTS.sentimentScore,
    },
    {
      key: 'recommendationRate',
      value: components.recommendationRate * COMPONENT_WEIGHTS.recommendationRate,
    },
    {
      key: 'positionAvg',
      value:
        components.positionAvg > 0
          ? ((5 - components.positionAvg) / 4) * 100 * COMPONENT_WEIGHTS.positionAvg
          : 0,
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
    condition: (i) => i.aviComponents.sentimentScore < 0,
    title: 'Migliora sentiment',
    description: () =>
      'Il sentiment medio è negativo. Affronta le recensioni negative e rafforza la comunicazione positiva.',
    impact: 7,
    effort: 3,
    component: 'sentimentScore',
  },
  {
    condition: (i) => i.aviComponents.sentimentScore >= 0 && i.aviComponents.sentimentScore < 0.5,
    title: 'Incrementa sentiment positivo',
    description: () =>
      'Il sentiment è neutra. Amplifica i messaggi positivi per migliorare la percezione del brand.',
    impact: 5,
    effort: 3,
    component: 'sentimentScore',
  },
  {
    condition: (i) => i.aviComponents.recommendationRate < 30,
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
