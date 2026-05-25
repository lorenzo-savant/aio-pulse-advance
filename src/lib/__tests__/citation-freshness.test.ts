import { describe, it, expect } from 'vitest'
import {
  analyseFreshness,
  bucketFor,
  extractLastModifiedFromHtml,
  FRESH_MAX_DAYS,
  MID_MAX_DAYS,
} from '@/lib/utils/citation-freshness'

// Deterministic clock: 2026-05-25T00:00:00Z
const NOW = new Date('2026-05-25T00:00:00Z').getTime()
const days = (n: number) => NOW - n * 86_400_000

describe('bucketFor', () => {
  it('classifies by the documented thresholds', () => {
    expect(bucketFor(0)).toBe('fresh')
    expect(bucketFor(FRESH_MAX_DAYS)).toBe('fresh')
    expect(bucketFor(FRESH_MAX_DAYS + 1)).toBe('mid')
    expect(bucketFor(MID_MAX_DAYS)).toBe('mid')
    expect(bucketFor(MID_MAX_DAYS + 1)).toBe('stale')
  })

  it('returns "unknown" for null / non-finite ages', () => {
    expect(bucketFor(null)).toBe('unknown')
    expect(bucketFor(Number.NaN)).toBe('unknown')
    expect(bucketFor(Number.POSITIVE_INFINITY)).toBe('unknown')
  })
})

describe('analyseFreshness — buckets + summary', () => {
  it('buckets pages and rolls up citation counts and shares', () => {
    const r = analyseFreshness(
      [
        { url: 'https://x.com/a', citationCount: 10, lastModifiedMs: days(30) }, // fresh
        { url: 'https://x.com/b', citationCount: 6, lastModifiedMs: days(200) }, // mid
        { url: 'https://x.com/c', citationCount: 4, lastModifiedMs: days(400) }, // stale
        { url: 'https://x.com/d', citationCount: 2, lastModifiedMs: null }, // unknown
      ],
      NOW,
    )
    expect(r.breakdown.pageCounts).toEqual({ fresh: 1, mid: 1, stale: 1, unknown: 1 })
    expect(r.breakdown.citationCounts).toEqual({ fresh: 10, mid: 6, stale: 4, unknown: 2 })
    expect(r.summary.totalCitations).toBe(22)
    // fresh share: 10/22 = 45.45… → 45.5
    expect(r.breakdown.citationShare.fresh).toBeCloseTo(45.5, 1)
  })

  it('reports summary stats including age coverage and median', () => {
    const r = analyseFreshness(
      [
        { url: 'a', citationCount: 1, lastModifiedMs: days(10) },
        { url: 'b', citationCount: 1, lastModifiedMs: days(100) },
        { url: 'c', citationCount: 1, lastModifiedMs: days(1000) },
        { url: 'd', citationCount: 1, lastModifiedMs: null },
      ],
      NOW,
    )
    expect(r.summary.totalPages).toBe(4)
    expect(r.summary.pagesWithAge).toBe(3)
    expect(r.summary.ageCoverage).toBe(75)
    // 10 + 100 + 1000 = 1110 / 3 ≈ 370 → rounded 370 with 1 decimal it's 370.0
    expect(r.summary.averageAgeDays).toBeCloseTo(370, 1)
    // median of [10, 100, 1000] = 100
    expect(r.summary.medianAgeDays).toBe(100)
  })
})

describe('analyseFreshness — correlation', () => {
  it('returns negative correlation when older pages get fewer citations', () => {
    const r = analyseFreshness(
      [
        { url: 'a', citationCount: 100, lastModifiedMs: days(10) },
        { url: 'b', citationCount: 50, lastModifiedMs: days(100) },
        { url: 'c', citationCount: 20, lastModifiedMs: days(300) },
        { url: 'd', citationCount: 5, lastModifiedMs: days(800) },
      ],
      NOW,
    )
    expect(r.correlation).not.toBeNull()
    expect(r.correlation!).toBeLessThan(-0.8)
  })

  it('returns null when fewer than 3 dated pages', () => {
    const r = analyseFreshness(
      [
        { url: 'a', citationCount: 1, lastModifiedMs: days(10) },
        { url: 'b', citationCount: 1, lastModifiedMs: days(100) },
        { url: 'c', citationCount: 1, lastModifiedMs: null },
      ],
      NOW,
    )
    expect(r.correlation).toBeNull()
  })

  it('returns null when all citation counts are equal (no variance)', () => {
    const r = analyseFreshness(
      [
        { url: 'a', citationCount: 5, lastModifiedMs: days(10) },
        { url: 'b', citationCount: 5, lastModifiedMs: days(200) },
        { url: 'c', citationCount: 5, lastModifiedMs: days(800) },
      ],
      NOW,
    )
    expect(r.correlation).toBeNull()
  })
})

describe('analyseFreshness — stale stars (refresh targets)', () => {
  it('surfaces high-cited stale pages, sorted by citation count', () => {
    const r = analyseFreshness(
      [
        { url: 'fresh-popular', citationCount: 100, lastModifiedMs: days(10) },
        { url: 'stale-popular', citationCount: 50, lastModifiedMs: days(800) },
        { url: 'stale-quiet', citationCount: 2, lastModifiedMs: days(500) },
        { url: 'stale-popular-2', citationCount: 30, lastModifiedMs: days(400) },
      ],
      NOW,
    )
    expect(r.staleStars.map((s) => s.url)).toEqual([
      'stale-popular',
      'stale-popular-2',
      'stale-quiet',
    ])
  })

  it('excludes stale pages with zero citations', () => {
    const r = analyseFreshness([{ url: 'a', citationCount: 0, lastModifiedMs: days(800) }], NOW)
    expect(r.staleStars).toEqual([])
  })

  it('caps stale stars at 10 entries', () => {
    const inputs = Array.from({ length: 15 }, (_, i) => ({
      url: `https://x.com/${i}`,
      citationCount: i + 1,
      lastModifiedMs: days(500),
    }))
    const r = analyseFreshness(inputs, NOW)
    expect(r.staleStars).toHaveLength(10)
  })
})

describe('extractLastModifiedFromHtml', () => {
  it('extracts JSON-LD dateModified', () => {
    const html = `<script type="application/ld+json">{"@type":"Article","dateModified":"2026-04-01T00:00:00Z"}</script>`
    const t = extractLastModifiedFromHtml(html)
    expect(t).toBe(Date.parse('2026-04-01T00:00:00Z'))
  })

  it('extracts article:modified_time meta', () => {
    const html = `<meta property="article:modified_time" content="2026-03-15T10:00:00Z">`
    const t = extractLastModifiedFromHtml(html)
    expect(t).toBe(Date.parse('2026-03-15T10:00:00Z'))
  })

  it('extracts <time datetime>', () => {
    const html = `<time datetime="2025-12-01">Dec 1, 2025</time>`
    const t = extractLastModifiedFromHtml(html)
    expect(t).toBe(Date.parse('2025-12-01'))
  })

  it('picks the most recent when multiple sources are present', () => {
    const html = `
      <meta property="article:modified_time" content="2024-01-01T00:00:00Z">
      <script type="application/ld+json">{"dateModified":"2026-05-01T00:00:00Z"}</script>
      <time datetime="2025-06-01">Jun 1</time>
    `
    const t = extractLastModifiedFromHtml(html)
    expect(t).toBe(Date.parse('2026-05-01T00:00:00Z'))
  })

  it('returns null when no date signal is present', () => {
    expect(extractLastModifiedFromHtml('<html><body>no dates here</body></html>')).toBeNull()
    expect(extractLastModifiedFromHtml('')).toBeNull()
  })
})
