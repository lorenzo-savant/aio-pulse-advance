// PATH: src/lib/utils/branded-search.ts
//
// Classifies GSC query rows as "branded" vs "non-branded" so the dashboard
// can plot the AEO/GEO signal Semrush calls out:
//   "Inside Google's AI Overviews and AI Mode, mentions can also increase
//    your search impressions. These impressions now show up in Google
//    Search Console, even if the user never clicks a link. When your brand
//    consistently appears in AI-generated summaries, users begin to
//    recognize and trust it — that can lead to more direct searches over
//    time."
//
// Branded volume going UP while ranking-page CTR goes DOWN is the
// classic "AI is making people search for you" pattern: the AI surface
// strips the click, but the brand sticks.
//
// Pure, no network, no dependency. Mirrors the posture of
// citation-classifier.ts and citation-depth.ts.

export interface QueryRow {
  query: string
  clicks: number
  impressions: number
  position?: number
  date?: string
}

export interface BrandedSplit {
  branded: { clicks: number; impressions: number; uniqueQueries: number }
  nonBranded: { clicks: number; impressions: number; uniqueQueries: number }
  total: { clicks: number; impressions: number; uniqueQueries: number }
  /** branded clicks / total clicks, 0-100, 1 decimal */
  brandedShareClicks: number
  /** branded impressions / total impressions, 0-100, 1 decimal */
  brandedShareImpressions: number
}

export interface BrandedDailyPoint {
  date: string
  brandedClicks: number
  brandedImpressions: number
  nonBrandedClicks: number
  nonBrandedImpressions: number
}

/**
 * Lowercase + collapse whitespace + strip diacritics so that "Savant",
 * "savant", " savant " and "savànt" all match the same brand anchor.
 */
function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Build a list of "branded anchors" from brand identity strings. We accept
 * the brand name, optional aliases, and the bare-domain (without TLD) so
 * that "acasting" matches both queries like "acasting login" and "acasting
 * se" — but the ≥3-char guard prevents short stop-words ("se", "ai") from
 * matching everything.
 */
export function brandAnchors(opts: {
  name: string
  aliases?: string[]
  domain?: string | null
}): string[] {
  const out = new Set<string>()
  const push = (s: string | undefined | null) => {
    if (!s) return
    const folded = fold(s)
    if (folded.length >= 3) out.add(folded)
  }
  push(opts.name)
  for (const a of opts.aliases ?? []) push(a)
  if (opts.domain) {
    const host = opts.domain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
    const root = host.split('/')[0] ?? host
    // Keep the bare domain ("acasting.se") AND the brand stem ("acasting").
    push(root)
    const stem = root.split('.')[0]
    if (stem && stem.length >= 3) push(stem)
  }
  return Array.from(out)
}

/**
 * Whether `query` mentions any of the brand anchors. Match is case- and
 * diacritic-insensitive; whole-word boundaries via folded-string regex so
 * "ai" inside "fair" never counts (already enforced by the ≥3 guard in
 * brandAnchors, but defence-in-depth here too).
 */
export function isBrandedQuery(query: string, anchors: string[]): boolean {
  if (anchors.length === 0) return false
  const folded = fold(query)
  if (folded.length === 0) return false
  for (const anchor of anchors) {
    if (anchor.length < 3) continue
    // Use a soft word-boundary: anchor surrounded by start/end-of-string,
    // whitespace, or common punctuation. Avoids matching "acasting" inside
    // "macastingo" (unlikely but harmless to guard).
    const re = new RegExp(
      `(^|[^\\p{L}\\p{N}])${anchor.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}([^\\p{L}\\p{N}]|$)`,
      'u',
    )
    if (re.test(folded)) return true
  }
  return false
}

/**
 * Aggregate a list of GSC query rows into a branded vs non-branded summary
 * + per-day timeline. `rows` is expected to be one row per (query, date)
 * pair — the typical shape stored in `gsc_performance` with
 * dimension_type='query'.
 */
export function classifyBrandedQueries(
  rows: QueryRow[],
  anchors: string[],
): { summary: BrandedSplit; timeline: BrandedDailyPoint[] } {
  const brandedQueries = new Set<string>()
  const nonBrandedQueries = new Set<string>()
  let brandedClicks = 0
  let brandedImpressions = 0
  let nonBrandedClicks = 0
  let nonBrandedImpressions = 0

  // Per-day buckets so the UI can plot the trend (branded share over time).
  const byDay = new Map<
    string,
    {
      brandedClicks: number
      brandedImpressions: number
      nonBrandedClicks: number
      nonBrandedImpressions: number
    }
  >()

  for (const r of rows) {
    if (!r || typeof r.query !== 'string') continue
    const q = r.query.trim()
    if (q.length === 0) continue
    const clicks = Math.max(0, Number(r.clicks) || 0)
    const impressions = Math.max(0, Number(r.impressions) || 0)
    const branded = isBrandedQuery(q, anchors)

    if (branded) {
      brandedClicks += clicks
      brandedImpressions += impressions
      brandedQueries.add(q)
    } else {
      nonBrandedClicks += clicks
      nonBrandedImpressions += impressions
      nonBrandedQueries.add(q)
    }

    if (r.date) {
      const day = r.date.slice(0, 10)
      const agg = byDay.get(day) ?? {
        brandedClicks: 0,
        brandedImpressions: 0,
        nonBrandedClicks: 0,
        nonBrandedImpressions: 0,
      }
      if (branded) {
        agg.brandedClicks += clicks
        agg.brandedImpressions += impressions
      } else {
        agg.nonBrandedClicks += clicks
        agg.nonBrandedImpressions += impressions
      }
      byDay.set(day, agg)
    }
  }

  const totalClicks = brandedClicks + nonBrandedClicks
  const totalImpressions = brandedImpressions + nonBrandedImpressions
  const pct1 = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0)

  const timeline: BrandedDailyPoint[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }))

  return {
    summary: {
      branded: {
        clicks: brandedClicks,
        impressions: brandedImpressions,
        uniqueQueries: brandedQueries.size,
      },
      nonBranded: {
        clicks: nonBrandedClicks,
        impressions: nonBrandedImpressions,
        uniqueQueries: nonBrandedQueries.size,
      },
      total: {
        clicks: totalClicks,
        impressions: totalImpressions,
        uniqueQueries: brandedQueries.size + nonBrandedQueries.size,
      },
      brandedShareClicks: pct1(brandedClicks, totalClicks),
      brandedShareImpressions: pct1(brandedImpressions, totalImpressions),
    },
    timeline,
  }
}

/**
 * Branded-volume growth rate, comparing the second half of a sorted
 * timeline against the first half. Positive % = branded volume rising
 * (the AEO signal). Returns null when there isn't enough data to compare.
 */
export function brandedGrowthRate(timeline: BrandedDailyPoint[]): {
  clicksDeltaPct: number | null
  impressionsDeltaPct: number | null
} {
  if (timeline.length < 4) return { clicksDeltaPct: null, impressionsDeltaPct: null }
  const mid = Math.floor(timeline.length / 2)
  const firstHalf = timeline.slice(0, mid)
  const secondHalf = timeline.slice(mid)
  const sum = (arr: BrandedDailyPoint[], key: 'brandedClicks' | 'brandedImpressions') =>
    arr.reduce((a, p) => a + p[key], 0)
  const cFirst = sum(firstHalf, 'brandedClicks')
  const cSecond = sum(secondHalf, 'brandedClicks')
  const iFirst = sum(firstHalf, 'brandedImpressions')
  const iSecond = sum(secondHalf, 'brandedImpressions')
  const delta = (a: number, b: number) => (a > 0 ? Math.round(((b - a) / a) * 1000) / 10 : null)
  return {
    clicksDeltaPct: delta(cFirst, cSecond),
    impressionsDeltaPct: delta(iFirst, iSecond),
  }
}
