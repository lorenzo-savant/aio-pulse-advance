// PATH: src/lib/services/geo-score.ts
//
// GEO Score — Generative Engine Optimization score.
//
// A 0–100 composite that measures how well-optimized a brand is for being
// surfaced and cited by generative AI engines (ChatGPT, Gemini, Perplexity…).
//
// It is computed from a `brand_health_scores` row. The scale of each stored
// field is fixed by the monitoring cron writer
// (src/app/api/cron/monitoring/route.ts):
//
//   citation_rate       0–100   (% of responses with ≥1 citation)
//   mention_rate        0–100   (% of responses mentioning the brand)
//   recommendation_rate 0–100   (% of responses recommending the brand)
//   sentiment_score     −1..1   (avg sentiment when mentioned)
//   position_avg        ≥1      (avg mention rank; 0 = never positioned)
//   hallucination_rate  0..1    (fraction of responses with hallucinations)
//
// Unlike the single-number AVI widget, GEO Score is a full diagnostic: it
// breaks the score into weighted pillars and emits prioritized, actionable
// recommendations for the weakest ones.

export interface GeoScoreInput {
  citationRate: number // 0–100
  mentionRate: number // 0–100
  recommendationRate: number // 0–100
  sentimentScore: number // −1..1
  positionAvg: number // ≥1, 0 = never positioned
  hallucinationRate: number // 0..1
}

export type GeoGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface GeoPillar {
  key: 'citation' | 'presence' | 'authority' | 'position' | 'trust'
  label: string
  /** Normalized pillar value, 0–100. */
  score: number
  /** Pillar weight in the composite (0–1). */
  weight: number
  /** Points this pillar contributes to the final score (score × weight). */
  contribution: number
}

export interface GeoScoreResult {
  /** Final composite, 0–100, one decimal. */
  score: number
  grade: GeoGrade
  pillars: GeoPillar[]
  /** Prioritized, actionable guidance for the weakest pillars. */
  recommendations: string[]
}

// Pillar weights — must sum to 1.0.
export const GEO_WEIGHTS = {
  citation: 0.3,
  presence: 0.25,
  authority: 0.2,
  position: 0.15,
  trust: 0.1,
} as const

const PILLAR_LABELS: Record<GeoPillar['key'], string> = {
  citation: 'Citation Rate',
  presence: 'Brand Presence',
  authority: 'Recommendation Authority',
  position: 'Answer Position',
  trust: 'Trust & Accuracy',
}

// A pillar at/above this normalized value is considered healthy; below it the
// pillar surfaces a recommendation.
const HEALTHY_THRESHOLD = 60

const clamp = (v: number, lo: number, hi: number): number =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo

const round1 = (v: number): number => Math.round(v * 10) / 10

/**
 * Normalize average mention position to 0–100 (higher = better).
 * Mirrors the position normalization in calculateAVI: positions 1→100,
 * 5+→0, and "never positioned" (0) maps to a neutral 50.
 */
function normalizePosition(positionAvg: number): number {
  if (positionAvg <= 0) return 50
  return clamp(((5 - positionAvg) / 4) * 100, 0, 100)
}

/** Normalize −1..1 sentiment to 0–100. */
function normalizeSentiment(sentiment: number): number {
  return ((clamp(sentiment, -1, 1) + 1) / 2) * 100
}

export function gradeFor(score: number): GeoGrade {
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 55) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

const RECOMMENDATIONS: Record<GeoPillar['key'], string> = {
  citation:
    'AI engines rarely cite your domain. Publish authoritative, fact-dense pages and a clean llms.txt so models have a citable source.',
  presence:
    'Your brand is mentioned in few answers. Broaden topical coverage and ensure your brand name and aliases appear in canonical content.',
  authority:
    'AI seldom recommends you when asked for options. Build comparison/“best of” content and earn third-party mentions that models trust.',
  position:
    'When mentioned, your brand appears late in answers. Lead key pages with concise, direct answers so models surface you first.',
  trust:
    'Negative sentiment or hallucinations are dragging the score. Correct outdated facts and strengthen structured data so models describe you accurately.',
}

/**
 * Compute the GEO Score from a single set of brand health metrics.
 * Pure and deterministic — safe to unit test and call from API routes.
 */
export function calculateGeoScore(input: GeoScoreInput): GeoScoreResult {
  const citationNorm = clamp(input.citationRate, 0, 100)
  const presenceNorm = clamp(input.mentionRate, 0, 100)
  const authorityNorm = clamp(input.recommendationRate, 0, 100)
  const positionNorm = normalizePosition(input.positionAvg)
  const sentimentNorm = normalizeSentiment(input.sentimentScore)
  const antiHallucination = clamp(100 - clamp(input.hallucinationRate, 0, 1) * 100, 0, 100)
  const trustNorm = (sentimentNorm + antiHallucination) / 2

  const pillarScores: Record<GeoPillar['key'], number> = {
    citation: citationNorm,
    presence: presenceNorm,
    authority: authorityNorm,
    position: positionNorm,
    trust: trustNorm,
  }

  const pillars: GeoPillar[] = (Object.keys(GEO_WEIGHTS) as GeoPillar['key'][]).map((key) => {
    const weight = GEO_WEIGHTS[key]
    const score = round1(pillarScores[key])
    return {
      key,
      label: PILLAR_LABELS[key],
      score,
      weight,
      contribution: round1(score * weight),
    }
  })

  const raw = pillars.reduce((sum, p) => sum + pillarScores[p.key] * p.weight, 0)
  const score = round1(clamp(raw, 0, 100))

  // Prioritize recommendations by weighted shortfall: a weak, heavily-weighted
  // pillar matters more than a weak, lightly-weighted one.
  const recommendations = pillars
    .filter((p) => p.score < HEALTHY_THRESHOLD)
    .sort(
      (a, b) => (HEALTHY_THRESHOLD - b.score) * b.weight - (HEALTHY_THRESHOLD - a.score) * a.weight,
    )
    .map((p) => RECOMMENDATIONS[p.key])

  return { score, grade: gradeFor(score), pillars, recommendations }
}
