// PATH: src/lib/utils/keyword-cannibalization.ts
//
// Detects "keyword cannibalization" — queries for which ≥2 pages of the
// same site rank in the same top-N window, splitting Google's
// attention and hurting overall performance.
//
// Closes the gap from the Semrush "Keyword Tracking" piece:
//   "When multiple pages on your site rank for the same keyword, they
//    can compete against each other and hurt your overall performance.
//    Cannibalization can lead to unstable rankings, reduced visibility,
//    or Google selecting the wrong page to rank."
//
// Pure aggregator over GSC (query, page, position, impressions, clicks)
// rows. The query/page join must be done by the caller — GSC's
// `getQueryPageMatrix` returns the right shape directly.

export interface QueryPageRow {
  query: string
  page: string
  position: number
  impressions: number
  clicks: number
}

export interface CompetingPage {
  page: string
  position: number
  impressions: number
  clicks: number
}

export type CannibalizationSeverity = 'critical' | 'moderate' | 'minor'

export interface CannibalizationRow {
  query: string
  /** Pages ranking for this query, best position first. */
  pages: CompetingPage[]
  /** # of competing pages (≥2 by definition). */
  pageCount: number
  /** Best position across the competing pages. */
  bestPosition: number
  /** Position gap between best and worst page (worst − best). */
  positionSpread: number
  /** Sum of impressions across all competing pages (impact proxy). */
  totalImpressions: number
  /** Sum of clicks — distinguishes "high-traffic cannibalization" from
   *  "lots of impressions but no clicks" patterns. */
  totalClicks: number
  /** Severity bucket for the UI. */
  severity: CannibalizationSeverity
}

export interface CannibalizationReport {
  /** Affected queries sorted by impact (totalImpressions desc). */
  rows: CannibalizationRow[]
  /** Unique pages that appear in at least one cannibalised query. */
  affectedPagesCount: number
  /** Total impressions across all cannibalised queries — single
   *  "size of the problem" KPI. */
  totalImpactImpressions: number
  /** Health score 0-100: 100 = no cannibalization in the sample.
   *  Computed as 100 × (1 − cannibalisedImpressions / totalImpressions). */
  healthScore: number
}

export interface CannibalizationOptions {
  /** Only count pages ranking in the top N (default 50). Beyond this
   *  pages aren't really competing — Google has already picked. */
  maxPosition?: number
  /** Skip queries with fewer than this many impressions (default 50). */
  minImpressions?: number
  /** Severity thresholds — both expressed as the number of pages
   *  competing for the same query. */
  criticalPageCount?: number
  moderatePageCount?: number
}

/**
 * Group raw GSC query-page rows into cannibalisation candidates.
 *
 * A query qualifies as cannibalised when ≥2 distinct pages rank for it
 * in the top `maxPosition` AND the query has ≥`minImpressions` total
 * impressions (else the noise drowns the signal).
 *
 * Severity:
 *   - critical = ≥3 competing pages
 *   - moderate = 2 competing pages and bestPosition ≤ 20
 *   - minor    = 2 competing pages and bestPosition > 20
 */
export function detectCannibalization(
  rows: QueryPageRow[],
  opts: CannibalizationOptions = {},
): CannibalizationReport {
  const maxPosition = opts.maxPosition ?? 50
  const minImpressions = opts.minImpressions ?? 50
  const critical = opts.criticalPageCount ?? 3
  const moderate = opts.moderatePageCount ?? 2

  // Group rows by query (trimmed, lowercased for case-insensitive grouping).
  const byQuery = new Map<
    string,
    { display: string; pages: Map<string, CompetingPage>; impressions: number }
  >()
  let totalImpressionsAll = 0

  for (const r of rows) {
    if (!r || typeof r.query !== 'string' || typeof r.page !== 'string') continue
    if (!Number.isFinite(r.position) || r.position <= 0 || r.position > maxPosition) continue
    const queryKey = r.query.trim().toLowerCase()
    if (queryKey.length === 0) continue
    totalImpressionsAll += r.impressions ?? 0

    let bucket = byQuery.get(queryKey)
    if (!bucket) {
      bucket = { display: r.query, pages: new Map(), impressions: 0 }
      byQuery.set(queryKey, bucket)
    }
    bucket.impressions += r.impressions ?? 0

    // Dedupe by URL — keep the best (lowest) position seen.
    const existing = bucket.pages.get(r.page)
    if (!existing || r.position < existing.position) {
      bucket.pages.set(r.page, {
        page: r.page,
        position: r.position,
        impressions: r.impressions ?? 0,
        clicks: r.clicks ?? 0,
      })
    } else {
      existing.impressions += r.impressions ?? 0
      existing.clicks += r.clicks ?? 0
    }
  }

  const cannibalised: CannibalizationRow[] = []
  const affectedPages = new Set<string>()
  let cannibalisedImpressions = 0

  for (const bucket of byQuery.values()) {
    if (bucket.pages.size < moderate) continue
    if (bucket.impressions < minImpressions) continue
    const pages = [...bucket.pages.values()].sort((a, b) => a.position - b.position)
    const positions = pages.map((p) => p.position)
    const bestPosition = positions[0]!
    const positionSpread = positions[positions.length - 1]! - bestPosition
    const totalImpressions = pages.reduce((s, p) => s + p.impressions, 0)
    const totalClicks = pages.reduce((s, p) => s + p.clicks, 0)
    cannibalisedImpressions += totalImpressions

    let severity: CannibalizationSeverity
    if (pages.length >= critical) severity = 'critical'
    else if (bestPosition <= 20) severity = 'moderate'
    else severity = 'minor'

    cannibalised.push({
      query: bucket.display,
      pages,
      pageCount: pages.length,
      bestPosition,
      positionSpread: Math.round(positionSpread * 10) / 10,
      totalImpressions,
      totalClicks,
      severity,
    })
    for (const p of pages) affectedPages.add(p.page)
  }

  cannibalised.sort(
    (a, b) => b.totalImpressions - a.totalImpressions || a.bestPosition - b.bestPosition,
  )

  const healthScore =
    totalImpressionsAll > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round((1 - cannibalisedImpressions / totalImpressionsAll) * 1000) / 10,
          ),
        )
      : 100

  return {
    rows: cannibalised,
    affectedPagesCount: affectedPages.size,
    totalImpactImpressions: cannibalisedImpressions,
    healthScore,
  }
}
