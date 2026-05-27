// PATH: src/lib/utils/personal-keyword-difficulty.ts
//
// Personal Keyword Difficulty (PKD) — adjusts a generic Keyword Difficulty
// score for THIS brand's standing, so the operator sees "how hard would
// it be for ME to rank for this term?" instead of the generic landscape.
//
// Closes the gap from the industry research "Low-Competition Keywords" piece:
//   "A keyword might show a KD% of 60, which sounds competitive on paper.
//    But if your PKD% comes back at 35, that term is actually within
//    reach for you."
//
// We don't have published full backlink + DR data. But we DO have signals
// that proxy brand authority well enough for a relative metric:
//   - GSC clicks volume (more total clicks = stronger track record)
//   - Average GSC position (lower number = better track record)
//   - Citation count in monitoring_results (AI is already pulling you)
//   - Page count / breadth (proxy for content depth)
//
// Pure, no network. Mirrors striking-distance.ts.

export interface AuthoritySignals {
  /** Total GSC clicks across the brand in the lookback window. */
  totalClicks: number
  /** Average GSC position across all keywords (lower = better). */
  avgPosition: number | null
  /** Total citations in monitoring_results in window. */
  totalAiCitations: number
  /** Unique pages cited or ranking (breadth signal). */
  uniquePages: number
}

export interface PkdResult {
  /** Adjusted difficulty 0-100. Same scale as KD. */
  pkd: number
  /** Authority factor 0-1; higher = stronger brand → bigger discount on KD. */
  authorityFactor: number
  /** Plain-English band for the UI badge. */
  band: 'within_reach' | 'stretch' | 'tough'
  /** Delta vs the generic KD (negative = easier for you). */
  deltaVsKd: number
}

/**
 * Convert raw authority signals into a 0-1 "authority factor". This is the
 * multiplier we subtract from KD: pkd ≈ kd × (1 - authorityFactor).
 *
 * Caps each input at a reasonable plateau so a single signal can't
 * dominate (e.g. 50k clicks shouldn't be 10× as influential as 5k).
 *
 * Calibration intent (rough):
 *   - Brand-new site, no signals → factor ~0.05 (almost no discount)
 *   - Small-to-mid brand (low five-figure clicks, some AI cites) → ~0.3
 *   - Established brand (six-figure clicks + many citations) → ~0.6
 *   - Anchor brand (enterprise-tier) → capped at 0.7
 */
export function computeAuthorityFactor(signals: AuthoritySignals): number {
  // Sub-scores all in [0, 1].
  const clicksScore = Math.min(1, Math.log10(Math.max(1, signals.totalClicks)) / 5) // 100k clicks → 1.0
  // Position: 1 → 1.0, 30 → 0.0. Linear over that range.
  const posScore =
    signals.avgPosition != null && Number.isFinite(signals.avgPosition)
      ? Math.max(0, Math.min(1, (30 - signals.avgPosition) / 29))
      : 0
  const citationsScore = Math.min(1, Math.log10(Math.max(1, signals.totalAiCitations + 1)) / 3) // 1000 cites → 1.0
  const breadthScore = Math.min(1, Math.log10(Math.max(1, signals.uniquePages + 1)) / 2.5) // ~316 pages → 1.0

  // Weighted blend. Clicks + position dominate; citations + breadth
  // contribute the AEO/topical angle.
  const blended = clicksScore * 0.35 + posScore * 0.25 + citationsScore * 0.25 + breadthScore * 0.15

  // Hard cap so PKD never crushes KD entirely.
  return Math.max(0, Math.min(0.7, Math.round(blended * 1000) / 1000))
}

/**
 * Compute Personal Keyword Difficulty for one keyword.
 *
 * @param kd Generic Keyword Difficulty 0-100 (e.g. from GSC striking-
 *           distance band, or a manually supplied value).
 * @param signals brand authority signals.
 */
export function computePersonalKeywordDifficulty(kd: number, signals: AuthoritySignals): PkdResult {
  const safeKd = Number.isFinite(kd) ? Math.max(0, Math.min(100, kd)) : 50
  const authorityFactor = computeAuthorityFactor(signals)
  const pkd = Math.round(safeKd * (1 - authorityFactor) * 10) / 10
  const deltaVsKd = Math.round((pkd - safeKd) * 10) / 10
  const band: PkdResult['band'] = pkd <= 35 ? 'within_reach' : pkd <= 60 ? 'stretch' : 'tough'
  return { pkd, authorityFactor, band, deltaVsKd }
}

/**
 * Convert a GSC position into a rough KD proxy when the caller doesn't
 * have a industry-standard KD number. Heuristic: bottom-of-page-1 (10) and
 * page-2 (11–20) → 50-60 KD, page 3+ → 65-80. This is a SIDE helper for
 * the Striking Distance widget so it can show a PKD column even without
 * an external KD source.
 */
export function estimateKdFromPosition(position: number): number {
  if (!Number.isFinite(position) || position <= 0) return 50
  if (position <= 5) return 35
  if (position <= 10) return 45
  if (position <= 15) return 55
  if (position <= 20) return 62
  if (position <= 30) return 70
  if (position <= 50) return 78
  return 85
}
