// PATH: src/lib/utils/striking-distance.ts
//
// Helpers for the "striking distance" keyword tactic: queries that already
// rank between positions 11–30 (so Google already considers the page
// relevant) and just need a content/meta push to break into page 1. Cheap
// SEO win that also feeds the AEO loop — pages that rank better get crawled
// more often by AI engines and earn more citations.
//
// Pure. No network, no DB, no LLM.

/** Rough CTR-by-position curve (industry averages from public AWR / Sistrix
 *  studies). Conservative and stable enough for relative uplift estimates. */
export function estimateCtrAtPosition(position: number): number {
  if (!Number.isFinite(position) || position <= 0) return 0
  if (position <= 1) return 0.3
  if (position <= 2) return 0.15
  if (position <= 3) return 0.1
  if (position <= 5) return 0.06
  if (position <= 10) return 0.03
  if (position <= 20) return 0.015
  return 0.005
}

/** Default target position when modelling the uplift of pushing a query into
 *  the top of page 1. Position 3 is a realistic, non-overpromising target. */
export const STRIKING_DISTANCE_TARGET_POSITION = 3

/** Estimated incremental clicks per month if the query were pushed to the
 *  target position. Never negative (returns 0 if current CTR already higher). */
export function estimateUpliftClicks(
  impressions: number,
  currentCtr: number,
  targetPosition = STRIKING_DISTANCE_TARGET_POSITION,
): number {
  if (!Number.isFinite(impressions) || impressions <= 0) return 0
  const targetCtr = estimateCtrAtPosition(targetPosition)
  const gain = targetCtr - (Number.isFinite(currentCtr) ? currentCtr : 0)
  if (gain <= 0) return 0
  return Math.round(impressions * gain)
}

/** Tag a striking-distance query by ease of action: low position = closer to
 *  page 1 (easier). High impressions + low position = highest leverage. */
export function strikingDistanceBand(position: number): 'edge' | 'mid' | 'far' {
  if (position <= 13) return 'edge' // one nudge from page 1
  if (position <= 20) return 'mid'
  return 'far'
}
