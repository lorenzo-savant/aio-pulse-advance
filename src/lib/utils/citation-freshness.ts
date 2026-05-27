// PATH: src/lib/utils/citation-freshness.ts
//
// Pure analyser that correlates citation volume with page freshness.
//
// Closes the gap from the AEO piece + AirOps study:
//   "95% of ChatGPT citations come from content published or updated
//    within the last 10 months, and pages with a clear 'last updated'
//    timestamp receive 1.8x more citations than those without one."
//
// What this does:
//   - Buckets cited pages by age (fresh / mid / stale / unknown).
//   - Computes Pearson correlation between page age (days) and citation
//     count for the pages we have both signals for. Negative correlation
//     = older pages get fewer citations (the expected AEO direction).
//   - Surfaces "stale stars" — pages with HIGH citation count AND age
//     above the stale threshold. These are the prime refresh candidates.
//
// Pure, no network, no deps. The fetch + dateModified parsing live in
// the API route; this utility just operates on the parsed inputs.

export interface FreshnessInput {
  url: string
  /** Times this URL appeared in monitoring_results.cited_urls in-window. */
  citationCount: number
  /** Most-recent dateModified parsed from JSON-LD / meta / time tag (ms),
   *  or null when we couldn't determine an age. */
  lastModifiedMs: number | null
  /** Engines that cited this URL — useful for the UI but not for the math. */
  engines?: string[]
}

export type FreshnessBucket = 'fresh' | 'mid' | 'stale' | 'unknown'

/**
 * Bucket boundaries (in days) — fresh ≤ 90, mid ≤ 365, stale > 365.
 * Mirrors the audit-side last-updated check so the operator sees the
 * SAME thresholds in both places.
 */
export const FRESH_MAX_DAYS = 90
export const MID_MAX_DAYS = 365

export function bucketFor(ageDays: number | null): FreshnessBucket {
  if (ageDays == null || !Number.isFinite(ageDays)) return 'unknown'
  if (ageDays <= FRESH_MAX_DAYS) return 'fresh'
  if (ageDays <= MID_MAX_DAYS) return 'mid'
  return 'stale'
}

export interface FreshnessRow extends FreshnessInput {
  ageDays: number | null
  bucket: FreshnessBucket
  /** When ageDays != null: ISO date (YYYY-MM-DD) of last modification. */
  lastModifiedISO: string | null
}

export interface FreshnessBreakdown {
  /** Number of pages per bucket. */
  pageCounts: Record<FreshnessBucket, number>
  /** Total citations attributed to pages in each bucket. */
  citationCounts: Record<FreshnessBucket, number>
  /** Citation share % per bucket (1 decimal). */
  citationShare: Record<FreshnessBucket, number>
}

export interface FreshnessReport {
  rows: FreshnessRow[]
  breakdown: FreshnessBreakdown
  /** Pearson correlation between age (days) and citation count, computed
   *  over rows with known ages. Range [-1, 1]; null if <3 rows or no
   *  variance. Negative = older pages get fewer citations (expected AEO
   *  direction). */
  correlation: number | null
  /** Pages that are both highly-cited AND stale (>365d). Refresh targets
   *  sorted by citation count desc. */
  staleStars: FreshnessRow[]
  /** Total pages, total citations, % of pages with a known age. */
  summary: {
    totalPages: number
    totalCitations: number
    pagesWithAge: number
    ageCoverage: number // pct of pages where we have a known age (1 decimal)
    averageAgeDays: number | null
    medianAgeDays: number | null
  }
}

function nowMs(): number {
  return Date.now()
}

function emptyBuckets<T extends number>(zero: T): Record<FreshnessBucket, T> {
  return { fresh: zero, mid: zero, stale: zero, unknown: zero }
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10
    : sorted[mid]!
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
 * Combine the inputs into a full freshness report. `now` is injectable for
 * deterministic tests.
 */
export function analyseFreshness(inputs: FreshnessInput[], now: number = nowMs()): FreshnessReport {
  const rows: FreshnessRow[] = inputs.map((p) => {
    const ageDays =
      p.lastModifiedMs != null && Number.isFinite(p.lastModifiedMs)
        ? Math.max(0, Math.floor((now - p.lastModifiedMs) / 86_400_000))
        : null
    const bucket = bucketFor(ageDays)
    const lastModifiedISO =
      p.lastModifiedMs != null && Number.isFinite(p.lastModifiedMs)
        ? new Date(p.lastModifiedMs).toISOString().slice(0, 10)
        : null
    return { ...p, ageDays, bucket, lastModifiedISO }
  })

  // Buckets.
  const pageCounts = emptyBuckets(0)
  const citationCounts = emptyBuckets(0)
  for (const r of rows) {
    pageCounts[r.bucket]++
    citationCounts[r.bucket] += r.citationCount
  }
  const totalCitations = rows.reduce((s, r) => s + r.citationCount, 0)
  const citationShare = emptyBuckets(0) as Record<FreshnessBucket, number>
  ;(Object.keys(citationCounts) as FreshnessBucket[]).forEach((b) => {
    citationShare[b] =
      totalCitations > 0 ? Math.round((citationCounts[b] / totalCitations) * 1000) / 10 : 0
  })

  // Correlation only over pages with known ages.
  const known = rows.filter((r) => r.ageDays != null)
  const correlation = pearson(
    known.map((r) => r.ageDays!),
    known.map((r) => r.citationCount),
  )

  const staleStars = rows
    .filter((r) => r.bucket === 'stale' && r.citationCount > 0)
    .sort((a, b) => b.citationCount - a.citationCount)
    .slice(0, 10)

  const ages = known.map((r) => r.ageDays!)
  const averageAgeDays =
    ages.length > 0 ? Math.round((ages.reduce((s, v) => s + v, 0) / ages.length) * 10) / 10 : null
  const medianAgeDays = median(ages)

  return {
    rows: rows.sort((a, b) => b.citationCount - a.citationCount),
    breakdown: { pageCounts, citationCounts, citationShare },
    correlation,
    staleStars,
    summary: {
      totalPages: rows.length,
      totalCitations,
      pagesWithAge: known.length,
      ageCoverage: rows.length > 0 ? Math.round((known.length / rows.length) * 1000) / 10 : 0,
      averageAgeDays,
      medianAgeDays,
    },
  }
}

// ─── Date extraction helpers — used by the API route ──────────────────────

/**
 * Extract the most-recent last-modified timestamp (ms since epoch) from
 * an HTML payload, looking at the same signals as the technical-seo-audit:
 *   - JSON-LD dateModified
 *   - <meta property="article:modified_time">
 *   - <meta name="last-modified">
 *   - <time datetime="…">
 * Returns null when none parses to a finite number.
 */
export function extractLastModifiedFromHtml(html: string): number | null {
  if (typeof html !== 'string' || html.length === 0) return null
  const candidates: number[] = []
  for (const m of html.matchAll(/"dateModified"\s*:\s*"([^"]+)"/gi)) {
    const t = Date.parse(m[1]!)
    if (Number.isFinite(t)) candidates.push(t)
  }
  const articleModified = html.match(
    /<meta[^>]*property=["']article:modified_time["'][^>]*content=["']([^"']+)["']/i,
  )
  if (articleModified) {
    const t = Date.parse(articleModified[1]!)
    if (Number.isFinite(t)) candidates.push(t)
  }
  const metaLastModified = html.match(
    /<meta[^>]*name=["']last-modified["'][^>]*content=["']([^"']+)["']/i,
  )
  if (metaLastModified) {
    const t = Date.parse(metaLastModified[1]!)
    if (Number.isFinite(t)) candidates.push(t)
  }
  const timeTag = html.match(/<time[^>]*datetime=["']([^"']+)["']/i)
  if (timeTag) {
    const t = Date.parse(timeTag[1]!)
    if (Number.isFinite(t)) candidates.push(t)
  }
  if (candidates.length === 0) return null
  return Math.max(...candidates)
}
