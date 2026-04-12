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
import { logger } from '@/lib/logger'

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
        position: z.number().int(),
        count: z.number().int(),
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

function buildAnalysisPrompt(responseText: string, brand: Brand, promptText: string): string {
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

  const { text: responseText, provider: simulationProvider } = await routerSimulate(
    prompt.text,
    engine,
    language,
  )
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
    // Zod valida e applica defaults — nessun campo silenziosamente undefined
    analysis = analysisOutputSchema.parse(rawParsed)
  } catch (e) {
    throw new Error(
      `Impossibile parsare/validare la risposta di analisi da ${analysisProvider}. ` +
        `Errore: ${e instanceof Error ? e.message : String(e)}. ` +
        `Raw: ${analysisRaw.slice(0, 200)}`,
    )
  }

  return {
    prompt_id: prompt.id,
    brand_id: brand.id,
    user_id: userId,
    engine,
    query_text: prompt.text || 'No query text',
    prompt_text: prompt.text || 'No prompt text',
    response_text: responseText.length > 5000 ? responseText.slice(0, 5000) + '…' : responseText,
    brand_mentioned: analysis.brand_mentioned,
    mention_position: analysis.mention_position ?? null,
    mention_count: analysis.mention_count,
    mention_type: analysis.mention_type as MentionType,
    visibility_score: Math.min(100, Math.max(0, analysis.visibility_score)),
    sentiment: analysis.sentiment as SentimentLabel,
    sentiment_score: Math.min(1, Math.max(-1, analysis.sentiment_score)),
    cited_urls: analysis.cited_urls,
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
