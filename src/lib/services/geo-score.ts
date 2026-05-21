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

export interface GeoRecommendation {
  pillar: GeoPillar['key']
  /** Pillar label, e.g. "Citation Rate". */
  label: string
  /** Pillar weight in the composite (0–1). */
  weight: number
  /** Current normalized pillar score, 0–100. */
  currentScore: number
  /** Points recoverable if this pillar reached 100 (gap × weight). The
   *  prioritization signal: bigger = more score upside. */
  upliftPts: number
  /** Why this pillar matters for GEO — the motivation for acting. */
  why: string
  /** Concrete, ordered actions to lift the pillar. */
  actions: string[]
}

export interface GeoScoreResult {
  /** Final composite, 0–100, one decimal. */
  score: number
  grade: GeoGrade
  pillars: GeoPillar[]
  /** Prioritized, motivated guidance for the weakest pillars (highest score
   *  upside first). */
  recommendations: GeoRecommendation[]
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

// Per-pillar motivation ("why act") + concrete actions ("how"). The why
// explains the GEO mechanism so the recommendation isn't a black box; the
// actions are ordered by leverage.
const REC_WHY: Record<GeoPillar['key'], string> = {
  citation:
    'Citations are the strongest GEO signal and the highest-weighted pillar (30%): when an engine links your domain as a source you gain both visibility AND trust, so gains here move the score the most.',
  presence:
    'Presence is the foundation — if the model never names you, no other pillar can help. It is the second-heaviest pillar (25%).',
  authority:
    'Being mentioned is good; being recommended is what converts. Models recommend brands that have social proof and clear comparison context.',
  position:
    'Where you appear in the answer decides whether users actually notice you. A low/zero score means you are effectively never positioned, even when mentioned.',
  trust:
    'Negative sentiment or hallucinations make models describe you inaccurately or steer users away — that caps the upside of every other pillar.',
}

const REC_ACTIONS: Record<GeoPillar['key'], string[]> = {
  citation: [
    'Publish fact-dense, well-structured pages models can quote (clear claims, data, dates).',
    'Add a clean llms.txt + schema.org markup so engines have a citable, machine-readable source.',
    'Earn citations on high-authority third-party sites the engines already trust.',
  ],
  presence: [
    'Broaden topical coverage around your category and the problems you solve.',
    'Make sure your brand name + aliases appear in canonical, crawlable content.',
    'Build a Wikipedia presence — roughly 48% of ChatGPT citations come from Wikipedia.',
  ],
  authority: [
    'Create comparison and “best of” pages that position you against named alternatives.',
    'Earn reviews and third-party mentions that models read as endorsements.',
    'Engage authentically on Reddit — roughly 47% of Perplexity citations come from Reddit.',
  ],
  position: [
    'Lead key pages with a concise, direct answer (answer-first format).',
    'Use clear headings and Q&A blocks the model can lift verbatim.',
    'Keep the most important facts in the first 100 words of the page.',
  ],
  trust: [
    'Correct outdated or wrong facts on your site and in third-party sources.',
    'Strengthen structured data (Organization, Product) so models describe you precisely.',
    'Publish an authoritative About page with verifiable, dated claims.',
  ],
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

  // Prioritize by recoverable points (gap × weight): the pillar with the most
  // score upside comes first, so the user works on what moves the needle most.
  const recommendations: GeoRecommendation[] = pillars
    .filter((p) => p.score < HEALTHY_THRESHOLD)
    .map((p) => ({
      pillar: p.key,
      label: p.label,
      weight: p.weight,
      currentScore: p.score,
      upliftPts: round1((100 - p.score) * p.weight),
      why: REC_WHY[p.key],
      actions: REC_ACTIONS[p.key],
    }))
    .sort((a, b) => b.upliftPts - a.upliftPts)

  return { score, grade: gradeFor(score), pillars, recommendations }
}
