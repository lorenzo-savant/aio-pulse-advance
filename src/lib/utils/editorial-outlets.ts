// PATH: src/lib/utils/editorial-outlets.ts
//
// AI-cited editorial outlet leaderboard. Within the "editorial" bucket
// of citation-source-category, rank the publications AI engines cite
// most often for queries in this brand's space — that's the PR target
// list. The Semrush 2026 brand-first piece reports >75% of AI brand
// mentions come from earned editorial/social, and a single Men's
// Journal mention pulling a noticeable lift in ChatGPT + Perplexity
// citations.
//
// Per-engine breakdown is the value-add over what citation-source-category
// already returns: "Forbes is hot on ChatGPT but ignored by Perplexity"
// changes WHERE the operator pitches.
//
// Pure transform on the same { engine, citedUrls } rows that drive
// citation-categories. No new API call, no new dep.

import { classifyCitationHost } from '@/lib/utils/citation-source-category'

export interface EditorialOutletRow {
  host: string
  count: number
  /** Count's share of the total editorial-citation pool, 0..1. */
  share: number
  /** Per-engine count for this host (engines absent from this list cited it zero times). */
  perEngine: Array<{ engine: string; count: number }>
  /** Distinct engines that cited this host at least once. */
  engineCoverage: number
}

export interface EditorialOutletLeaderboard {
  /** Top-N hosts. */
  outlets: EditorialOutletRow[]
  /** Total editorial citations across the input rows (denominator for share). */
  totalEditorialCitations: number
  /** Engines seen at least once in the editorial subset (sorted alphabetically). */
  engines: string[]
}

export interface EditorialCitationRow {
  engine: string
  citedUrls: string[]
}

export interface EditorialOutletOptions {
  /** Hard cap on the number of outlets returned. Default 15. */
  limit?: number
  /** Brand-owned domains — excluded from the editorial bucket (first-party). */
  brandDomains?: string[]
}

export function buildEditorialOutletLeaderboard(
  rows: EditorialCitationRow[],
  options: EditorialOutletOptions = {},
): EditorialOutletLeaderboard {
  const limit = Math.max(1, Math.min(100, options.limit ?? 15))
  const brandDomains = options.brandDomains ?? []

  // host → { total, byEngine: Map<engine, count> }
  const hostMap = new Map<string, { total: number; byEngine: Map<string, number> }>()
  const engineSet = new Set<string>()
  let totalEditorialCitations = 0

  for (const row of rows) {
    if (!row.citedUrls || row.citedUrls.length === 0) continue
    for (const url of row.citedUrls) {
      const { category, host } = classifyCitationHost(url, brandDomains)
      if (category !== 'editorial' || !host) continue
      totalEditorialCitations++
      engineSet.add(row.engine)
      let agg = hostMap.get(host)
      if (!agg) {
        agg = { total: 0, byEngine: new Map() }
        hostMap.set(host, agg)
      }
      agg.total += 1
      agg.byEngine.set(row.engine, (agg.byEngine.get(row.engine) ?? 0) + 1)
    }
  }

  const outlets: EditorialOutletRow[] = Array.from(hostMap.entries())
    .map(([host, agg]) => {
      const perEngine = Array.from(agg.byEngine.entries())
        .map(([engine, count]) => ({ engine, count }))
        .sort((a, b) => b.count - a.count || a.engine.localeCompare(b.engine))
      return {
        host,
        count: agg.total,
        share: totalEditorialCitations > 0 ? agg.total / totalEditorialCitations : 0,
        perEngine,
        engineCoverage: perEngine.length,
      }
    })
    // Most-cited first; break ties by wider engine coverage, then host name
    // for a deterministic order.
    .sort(
      (a, b) =>
        b.count - a.count || b.engineCoverage - a.engineCoverage || a.host.localeCompare(b.host),
    )
    .slice(0, limit)

  return {
    outlets,
    totalEditorialCitations,
    engines: Array.from(engineSet).sort(),
  }
}
