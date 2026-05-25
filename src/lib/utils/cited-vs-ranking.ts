// PATH: src/lib/utils/cited-vs-ranking.ts
//
// Cross-references AI-cited URLs with their Google organic positions to
// surface a specific class of opportunity: pages the AI engines cite
// often but that Google ranks beyond page 1.
//
// Closes the gap from the Semrush "AI Mode" study:
//   "Our recent research on the impact of AI on SEO traffic found that
//    most of ChatGPT's citations in that study sample were pulled from
//    URLs ranking beyond position 21+ on Google."
//
// What this answers:
//   - Which of MY pages does AI cite while Google ranks them poorly?
//     (the SEO uplift opportunities — AI already trusts the page, the
//     SERP click is the gap.)
//   - Which of MY pages does Google rank well that AI ignores?
//     (the AEO opportunities — the SEO foundation is there, the AI
//     citation hook is the gap.)
//
// Pure aggregator over (cited URL, citation count) + (page, position)
// pairs. The data sources are already in the stack (monitoring_results
// + gsc_performance dimension_type='page').

export interface CitedUrlInput {
  /** Normalised URL (case-insensitive, trailing-slash dropped). */
  url: string
  /** Times the URL appeared in monitoring_results.cited_urls in window. */
  citationCount: number
  /** Engines that cited the URL — surfaced for the UI but not used in math. */
  engines?: string[]
}

export interface GscPageInput {
  url: string
  position: number
  clicks: number
  impressions: number
}

export interface CrossRefRow {
  url: string
  citationCount: number
  /** Google position when found in GSC; null when GSC has no record. */
  position: number | null
  clicks: number
  impressions: number
  engines: string[]
  /** Opportunity flag:
   *  - 'seo_gap' = AI cites this often but Google ranks it deep (>10).
   *  - 'aeo_gap' = Google ranks this well (top 10) but AI rarely cites it.
   *  - 'aligned' = Both AI cites and Google ranks reasonably well.
   *  - 'no_gsc' = AI cites it but GSC has no data for the page. */
  opportunity: 'seo_gap' | 'aeo_gap' | 'aligned' | 'no_gsc'
}

export interface CrossRefReport {
  rows: CrossRefRow[]
  /** Convenience filters for the UI. */
  seoGaps: CrossRefRow[]
  aeoGaps: CrossRefRow[]
  aligned: CrossRefRow[]
  /** Summary counters. */
  totals: {
    citedPages: number
    seoGapPages: number
    aeoGapPages: number
    alignedPages: number
  }
  /** Pearson correlation between citation count and Google position. */
  citationVsPositionCorrelation: number | null
}

/** Lowercase + strip trailing slash for stable URL matching. */
function normalise(rawUrl: string): string {
  try {
    const u = new URL(rawUrl)
    const path = u.pathname.replace(/\/+$/, '') || '/'
    return `${u.protocol}//${u.host.toLowerCase()}${path}`
  } catch {
    return rawUrl.toLowerCase().replace(/\/+$/, '')
  }
}

function classify(citationCount: number, position: number | null): CrossRefRow['opportunity'] {
  if (position == null) return 'no_gsc'
  // SEO gap: AI cites it ≥2× AND Google ranks it deeper than position 10.
  if (citationCount >= 2 && position > 10) return 'seo_gap'
  // AEO gap: Google ranks top-10 but AI rarely cites (1 mention or less).
  if (position <= 10 && citationCount <= 1) return 'aeo_gap'
  return 'aligned'
}

function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null
  const n = xs.length
  const meanX = xs.reduce((s, v) => s + v, 0) / n
  const meanY = ys.reduce((s, v) => s + v, 0) / n
  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX
    const dy = ys[i]! - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  if (denX === 0 || denY === 0) return null
  return Math.round((num / Math.sqrt(denX * denY)) * 1000) / 1000
}

/**
 * Cross-reference cited URLs with GSC page data to produce a per-URL
 * report with opportunity classification.
 *
 * Both inputs should be pre-filtered to the brand's owned domain — the
 * util doesn't filter by ownership because that's a caller concern.
 */
export function crossReferenceCitedVsRanking(
  cited: CitedUrlInput[],
  gscPages: GscPageInput[],
): CrossRefReport {
  // Build a lookup map of normalised URL → GSC position record.
  const byUrl = new Map<string, GscPageInput>()
  for (const p of gscPages) {
    if (!p || typeof p.url !== 'string' || !Number.isFinite(p.position) || p.position <= 0) continue
    const key = normalise(p.url)
    const existing = byUrl.get(key)
    if (!existing || p.position < existing.position) byUrl.set(key, p)
  }

  // Deduplicate cited URLs case-insensitively, summing counts when needed.
  const citedAgg = new Map<string, CitedUrlInput>()
  for (const c of cited) {
    if (!c || typeof c.url !== 'string') continue
    const key = normalise(c.url)
    const existing = citedAgg.get(key)
    if (existing) {
      existing.citationCount += c.citationCount
      const engines = new Set([...(existing.engines ?? []), ...(c.engines ?? [])])
      existing.engines = [...engines]
    } else {
      citedAgg.set(key, { url: key, citationCount: c.citationCount, engines: c.engines ?? [] })
    }
  }

  const rows: CrossRefRow[] = []
  for (const c of citedAgg.values()) {
    const gsc = byUrl.get(c.url) ?? null
    const position = gsc ? gsc.position : null
    rows.push({
      url: c.url,
      citationCount: c.citationCount,
      position,
      clicks: gsc?.clicks ?? 0,
      impressions: gsc?.impressions ?? 0,
      engines: c.engines ?? [],
      opportunity: classify(c.citationCount, position),
    })
  }

  // Also surface AEO gaps from the GSC side — pages Google ranks top-10
  // that the citation set never mentions.
  for (const [key, p] of byUrl) {
    if (citedAgg.has(key)) continue // already considered
    if (p.position > 10) continue
    rows.push({
      url: key,
      citationCount: 0,
      position: p.position,
      clicks: p.clicks,
      impressions: p.impressions,
      engines: [],
      opportunity: 'aeo_gap',
    })
  }

  // Sort: SEO gaps first (most actionable), then by citation count desc.
  const opportunityRank: Record<CrossRefRow['opportunity'], number> = {
    seo_gap: 0,
    aeo_gap: 1,
    aligned: 2,
    no_gsc: 3,
  }
  rows.sort(
    (a, b) =>
      opportunityRank[a.opportunity] - opportunityRank[b.opportunity] ||
      b.citationCount - a.citationCount ||
      (a.position ?? 999) - (b.position ?? 999),
  )

  const seoGaps = rows.filter((r) => r.opportunity === 'seo_gap')
  const aeoGaps = rows.filter((r) => r.opportunity === 'aeo_gap')
  const aligned = rows.filter((r) => r.opportunity === 'aligned')

  // Correlation only over rows with known position AND ≥1 citation.
  const cor = pearson(
    rows.filter((r) => r.position != null && r.citationCount > 0).map((r) => r.position!),
    rows.filter((r) => r.position != null && r.citationCount > 0).map((r) => r.citationCount),
  )

  return {
    rows,
    seoGaps,
    aeoGaps,
    aligned,
    totals: {
      citedPages: citedAgg.size,
      seoGapPages: seoGaps.length,
      aeoGapPages: aeoGaps.length,
      alignedPages: aligned.length,
    },
    citationVsPositionCorrelation: cor,
  }
}
