import { describe, it, expect } from 'vitest'
import {
  crossReferenceCitedVsRanking,
  type CitedUrlInput,
  type GscPageInput,
} from '@/lib/utils/cited-vs-ranking'

describe('crossReferenceCitedVsRanking — opportunity classification', () => {
  it('flags SEO gaps — AI cites ≥2× but Google ranks beyond top 10', () => {
    const cited: CitedUrlInput[] = [{ url: 'https://acme.com/blog/post', citationCount: 4 }]
    const gsc: GscPageInput[] = [
      { url: 'https://acme.com/blog/post', position: 23, clicks: 0, impressions: 500 },
    ]
    const r = crossReferenceCitedVsRanking(cited, gsc)
    expect(r.seoGaps).toHaveLength(1)
    expect(r.seoGaps[0]!.opportunity).toBe('seo_gap')
    expect(r.seoGaps[0]!.position).toBe(23)
  })

  it('flags AEO gaps — Google ranks top 10 but AI cites ≤1×', () => {
    const cited: CitedUrlInput[] = [
      // The cited page below has citation 1 → still AEO gap because <=1.
      { url: 'https://acme.com/pricing', citationCount: 1 },
    ]
    const gsc: GscPageInput[] = [
      { url: 'https://acme.com/pricing', position: 4, clicks: 800, impressions: 12000 },
      // Page Google ranks well but the citation set doesn't mention at all.
      { url: 'https://acme.com/features', position: 6, clicks: 400, impressions: 8000 },
    ]
    const r = crossReferenceCitedVsRanking(cited, gsc)
    expect(r.aeoGaps.length).toBeGreaterThanOrEqual(2)
    expect(r.aeoGaps.some((g) => g.url.endsWith('/pricing'))).toBe(true)
    expect(r.aeoGaps.some((g) => g.url.endsWith('/features'))).toBe(true)
  })

  it('flags aligned — Google top 10 AND citation ≥2', () => {
    const cited: CitedUrlInput[] = [{ url: 'https://acme.com/best', citationCount: 5 }]
    const gsc: GscPageInput[] = [
      { url: 'https://acme.com/best', position: 3, clicks: 1200, impressions: 20000 },
    ]
    const r = crossReferenceCitedVsRanking(cited, gsc)
    expect(r.aligned).toHaveLength(1)
    expect(r.aligned[0]!.opportunity).toBe('aligned')
  })

  it('flags no_gsc — AI cites but GSC has no data', () => {
    const cited: CitedUrlInput[] = [{ url: 'https://acme.com/orphan', citationCount: 3 }]
    const r = crossReferenceCitedVsRanking(cited, [])
    expect(r.rows[0]!.opportunity).toBe('no_gsc')
    expect(r.rows[0]!.position).toBeNull()
  })
})

describe('crossReferenceCitedVsRanking — deduplication', () => {
  it('normalises URLs (trailing slash + case) and sums citations', () => {
    const cited: CitedUrlInput[] = [
      { url: 'https://Acme.com/blog/post/', citationCount: 2, engines: ['chatgpt'] },
      { url: 'https://acme.com/blog/post', citationCount: 3, engines: ['gemini'] },
    ]
    const gsc: GscPageInput[] = [
      { url: 'https://acme.com/blog/post', position: 22, clicks: 0, impressions: 600 },
    ]
    const r = crossReferenceCitedVsRanking(cited, gsc)
    expect(r.totals.citedPages).toBe(1)
    expect(r.rows[0]!.citationCount).toBe(5)
    expect(r.rows[0]!.engines.sort()).toEqual(['chatgpt', 'gemini'])
  })

  it('keeps the best (lowest) GSC position when duplicates exist', () => {
    const cited: CitedUrlInput[] = [{ url: 'https://acme.com/p', citationCount: 5 }]
    const gsc: GscPageInput[] = [
      { url: 'https://acme.com/p', position: 15, clicks: 100, impressions: 500 },
      { url: 'https://acme.com/p', position: 8, clicks: 200, impressions: 700 },
    ]
    const r = crossReferenceCitedVsRanking(cited, gsc)
    expect(r.rows[0]!.position).toBe(8)
  })
})

describe('crossReferenceCitedVsRanking — sort + correlation', () => {
  it('sorts SEO gaps first, then AEO gaps, then aligned, then no_gsc', () => {
    const cited: CitedUrlInput[] = [
      { url: 'https://acme.com/orphan', citationCount: 4 }, // no_gsc
      { url: 'https://acme.com/seo-gap', citationCount: 5 }, // seo_gap
      { url: 'https://acme.com/aligned', citationCount: 3 }, // aligned
    ]
    const gsc: GscPageInput[] = [
      { url: 'https://acme.com/seo-gap', position: 25, clicks: 0, impressions: 300 },
      { url: 'https://acme.com/aligned', position: 4, clicks: 80, impressions: 600 },
      { url: 'https://acme.com/aeo-only', position: 6, clicks: 250, impressions: 4000 },
    ]
    const r = crossReferenceCitedVsRanking(cited, gsc)
    const opportunities = r.rows.map((x) => x.opportunity)
    expect(opportunities[0]).toBe('seo_gap')
    expect(opportunities.indexOf('aeo_gap')).toBeGreaterThan(opportunities.indexOf('seo_gap'))
    expect(opportunities.indexOf('aligned')).toBeGreaterThan(opportunities.indexOf('aeo_gap'))
    expect(opportunities.lastIndexOf('no_gsc')).toBe(opportunities.length - 1)
  })

  it('computes Pearson correlation between citation count and position', () => {
    const cited: CitedUrlInput[] = [
      { url: 'https://acme.com/a', citationCount: 10 }, // top of citation funnel
      { url: 'https://acme.com/b', citationCount: 5 },
      { url: 'https://acme.com/c', citationCount: 2 },
      { url: 'https://acme.com/d', citationCount: 1 },
    ]
    const gsc: GscPageInput[] = [
      { url: 'https://acme.com/a', position: 5, clicks: 0, impressions: 0 },
      { url: 'https://acme.com/b', position: 8, clicks: 0, impressions: 0 },
      { url: 'https://acme.com/c', position: 15, clicks: 0, impressions: 0 },
      { url: 'https://acme.com/d', position: 22, clicks: 0, impressions: 0 },
    ]
    const r = crossReferenceCitedVsRanking(cited, gsc)
    // Negative correlation: more citations correlate with better (lower) position.
    expect(r.citationVsPositionCorrelation).not.toBeNull()
    expect(r.citationVsPositionCorrelation!).toBeLessThan(-0.8)
  })

  it('returns null correlation when fewer than 3 paired rows exist', () => {
    const r = crossReferenceCitedVsRanking(
      [{ url: 'https://a.com/x', citationCount: 1 }],
      [{ url: 'https://a.com/x', position: 10, clicks: 0, impressions: 0 }],
    )
    expect(r.citationVsPositionCorrelation).toBeNull()
  })
})

describe('crossReferenceCitedVsRanking — totals', () => {
  it('returns accurate per-bucket totals', () => {
    const cited: CitedUrlInput[] = [
      { url: 'https://a.com/seo1', citationCount: 5 },
      { url: 'https://a.com/seo2', citationCount: 4 },
      { url: 'https://a.com/align', citationCount: 6 },
      { url: 'https://a.com/orphan', citationCount: 2 },
    ]
    const gsc: GscPageInput[] = [
      { url: 'https://a.com/seo1', position: 30, clicks: 0, impressions: 0 },
      { url: 'https://a.com/seo2', position: 25, clicks: 0, impressions: 0 },
      { url: 'https://a.com/align', position: 4, clicks: 0, impressions: 0 },
      { url: 'https://a.com/aeo-only', position: 7, clicks: 0, impressions: 0 },
    ]
    const r = crossReferenceCitedVsRanking(cited, gsc)
    expect(r.totals.citedPages).toBe(4)
    expect(r.totals.seoGapPages).toBe(2)
    expect(r.totals.alignedPages).toBe(1)
    expect(r.totals.aeoGapPages).toBeGreaterThanOrEqual(1) // /aeo-only
  })
})
