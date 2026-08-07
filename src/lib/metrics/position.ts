// PATH: src/lib/metrics/position.ts
//
// One definition of "how good is this brand's position in an answer".
//
// Deliberately dependency-free so that the server scorers and the client chart
// component can all import it. Three copies of this formula existed precisely
// because there was nowhere shared to put it.
//
// WHAT WENT WRONG
// `mention_position` is the index of the SENTENCE in which the brand first
// appears. It is not a 1-5 search-result rank, and it routinely runs well past
// 5 in ordinary prose.
//
// Commit 1a1e10d established that, set POSITION_SCALE_MAX to 20, and shipped
// scripts/recalc-health-scores.mjs to recompute the stored rows. But it only
// fixed the AVI. The old 1-5 formula stayed in three other places:
//
//   · services/geo-score.ts        — the GEO Score's position pillar (15%)
//   · services/monitoring.ts       — competitor weakest-component selection
//   · components/dashboard/AVIScoreCard.tsx — the Position bar, rendered
//     directly beneath an AVI computed on the correct scale, so the card
//     contradicted itself on screen
//
// A comment in geo-score.ts asserted it "mirrors the position normalization in
// calculateAVI". That was true before 1a1e10d and false after, which is why
// nobody caught the divergence by reading.
//
// WHY 20, MEASURED RATHER THAN CHOSEN
// Against 1610 real mention positions:
//
//   p50=1  p75=4  p90=12  p95=17  p99=20  max=218
//
// 20 is almost exactly the 99th percentile. Raising the ceiling to 30 changes
// one row out of 203; lowering it to 5 sends 24% of stored brand rows to zero
// on a pillar worth 15% of their score. The scale is not a preference.

/**
 * Highest sentence index that still earns a non-zero position score.
 *
 * A brand first named at or beyond this sentence scores 0 — genuinely buried.
 */
export const POSITION_SCALE_MAX = 20

/**
 * Normalise a 1-based sentence index to 0-100, higher being better.
 *
 * Position 1 (first sentence) scores 100; POSITION_SCALE_MAX and beyond score
 * 0. Values at or below 0 are the "never positioned" sentinel and are NOT
 * handled here — callers must exclude that case rather than let it become a
 * number, because a brand no engine ever positioned has no position score, and
 * substituting one fabricates a measurement.
 */
export function normalizePositionScore(position: number): number {
  const normalized = ((POSITION_SCALE_MAX - position) / (POSITION_SCALE_MAX - 1)) * 100
  return Math.max(0, Math.min(100, normalized))
}

/** True when the value is a real measurement rather than the absence sentinel. */
export function hasMeasuredPosition(position: number | null | undefined): position is number {
  return position != null && position > 0
}
