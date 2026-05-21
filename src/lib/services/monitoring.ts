// PATH: src/lib/services/monitoring.ts
import { z } from 'zod'
import type {
  MonitoringEngine,
  MonitoringResult,
  Brand,
  Prompt,
  SentimentLabel,
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
import { logger } from '@/lib/logger'

// Engines whose API returns REAL web citations (Gemini grounding, Perplexity
// Sonar). The others (ChatGPT, Claude) answer from model memory, so any URL in
// their text is unreliable — those get Brave-grounded citations instead.
const NATIVE_CITATION_ENGINES: MonitoringEngine[] = ['gemini', 'perplexity']

function parseJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
  return JSON.parse(cleaned) as T
}

// ─── Zod schema per validare la risposta AI ───────────────────────────────────
const analysisOutputSchema = z.object({
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
  has_hallucination: z.boolean().default(false),
  hallucination_flags: z
    .array(
      z.object({
        text: z.string(),
        severity: z.enum(['low', 'medium', 'high']),
        type: z.enum(['factual_error', 'attribution_error', 'fabrication', 'date_error']),
      }),
    )
    .optional()
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
  "cited_urls": ["<url>"],
  "competitor_mentions": [
    {"name": "<n>", "position": <integer>, "count": <integer>}
  ],
  "has_hallucination": <boolean>,
  "hallucination_flags": [
    {
      "text": "<the potentially false claim>",
      "severity": <"low" | "medium" | "high">,
      "type": <"factual_error" | "attribution_error" | "fabrication" | "date_error">
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

  const {
    text: responseText,
    provider: simulationProvider,
    citations: engineCitations = [],
  } = await routerSimulate(prompt.text, engine, language, brand)
  logger.info('Engine simulation completed', {
    service: 'monitoring',
    engine,
    provider: simulationProvider,
  })

  const analysisPrompt = buildAnalysisPrompt(responseText, brand, prompt.text)
  const { text: analysisRaw, provider: analysisProvider } = await routerAnalyze(analysisPrompt)
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

  // ── Citations ────────────────────────────────────────────────────────────
  // Gemini/Perplexity return real web citations → clean (de-junk + dedup) the
  // engine + in-text URLs, and only Brave-ground if they came back empty.
  // ChatGPT/Claude answer from memory, so their in-text URLs are unreliable —
  // ground against real Brave sources instead (cached: ~1 hit per unique
  // prompt). Brave grounding soft-fails to [] so a run never breaks on quota.
  let citedUrls: string[]
  if (NATIVE_CITATION_ENGINES.includes(engine)) {
    citedUrls = cleanCitations([...engineCitations, ...analysis.cited_urls])
    if (citedUrls.length === 0) {
      citedUrls = (await groundCitationsViaBrave(prompt.text, language)).citations
    }
  } else {
    const grounded = await groundCitationsViaBrave(prompt.text, language)
    citedUrls =
      grounded.citations.length > 0 ? grounded.citations : cleanCitations(analysis.cited_urls)
  }

  return {
    prompt_id: prompt.id,
    brand_id: brand.id,
    user_id: userId,
    engine,
    prompt_text: prompt.text || 'No prompt text',
    response_text: responseText.length > 5000 ? responseText.slice(0, 5000) + '…' : responseText,
    brand_mentioned: analysis.brand_mentioned,
    mention_position: analysis.mention_position ?? null,
    mention_count: analysis.mention_count,
    mention_type: analysis.mention_type as MentionType,
    visibility_score: Math.min(100, Math.max(0, analysis.visibility_score)),
    sentiment: analysis.sentiment as SentimentLabel,
    sentiment_score: Math.min(1, Math.max(-1, analysis.sentiment_score)),
    cited_urls: citedUrls,
    competitor_mentions: analysis.competitor_mentions as CompetitorMention[],
    has_hallucination: analysis.has_hallucination,
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
}

export async function analyzeSentiment(text: string, brandName: string): Promise<SentimentResult> {
  const prompt = `Analyze the sentiment of this text toward the brand "${brandName}".

TEXT:
"""
${text.slice(0, 4000)}
"""

Respond ONLY with valid JSON (no markdown):
{
  "sentiment": <"positive" | "negative" | "neutral">,
  "score": <float -1.0 to 1.0>,
  "confidence": <integer 0-100>,
  "reasoning": "<one paragraph explanation>",
  "aspects": [
    {
      "aspect": "<what aspect of the brand>",
      "sentiment": <"positive" | "negative" | "neutral">,
      "explanation": "<brief reason>"
    }
  ]
}`

  const { text: raw, provider } = await routerAnalyze(prompt)
  logger.info('Sentiment analysis completed', { service: 'monitoring', provider })
  return parseJson<SentimentResult>(raw)
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
      "type": <"factual_error" | "attribution_error" | "fabrication" | "date_error">
    }
  ],
  "summary": "<one paragraph overall assessment>"
}`

  const { text: raw, provider } = await routerAnalyze(prompt)
  logger.info('Hallucination detection completed', { service: 'monitoring', provider })
  return parseJson<HallucinationResult>(raw)
}

// ─── AVI Formula ─────────────────────────────────────────────────────────────

export interface AVIInput {
  citationRate: number
  mentionFrequency: number
  sentimentScore: number
  recommendationRate: number
  positionAvg: number
  hallucinationIndex: number
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
  const sentimentNorm = ((Math.max(-1, Math.min(1, sentimentScore)) + 1) / 2) * 100
  const positionNorm =
    positionAvg <= 0 ? 50 : Math.max(0, Math.min(100, ((5 - positionAvg) / 4) * 100))
  const antiHallucination = Math.max(0, 100 - hallucinationIndex)

  const raw =
    citationRate * 0.2 +
    mentionFrequency * 0.2 +
    sentimentNorm * 0.15 +
    recommendationRate * 0.2 +
    positionNorm * 0.15 +
    antiHallucination * 0.1

  return Math.min(100, Math.max(0, Math.round(raw * 10) / 10))
}

export function calculateAVIFromResults(
  results: Array<{
    brand_mentioned: boolean
    visibility_score: number
    sentiment_score: number | null
    cited_urls: string[]
    has_hallucination: boolean
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
  const cited = results.filter((r) => r.cited_urls && r.cited_urls.length > 0)
  const hallucinated = results.filter((r) => r.has_hallucination)
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
    recommendationRate: (mentioned.length / total) * 100,
    positionAvg:
      positionsValid.length > 0
        ? positionsValid.reduce((a, p) => a + p, 0) / positionsValid.length
        : 0,
    hallucinationIndex: (hallucinated.length / total) * 100,
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
    {
      key: 'hallucinationIndex',
      value: (100 - components.hallucinationIndex) * COMPONENT_WEIGHTS.hallucinationIndex,
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
    has_hallucination: boolean
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
    condition: (i) => i.aviComponents.hallucinationIndex > 20,
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
