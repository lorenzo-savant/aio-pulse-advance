import { describe, it, expect } from 'vitest'
import {
  classifySidebarBucket,
  computeSidebarDominance,
  type SidebarRowInput,
} from '@/lib/utils/sidebar-dominance'

describe('classifySidebarBucket', () => {
  it('detects UGC hosts', () => {
    expect(classifySidebarBucket('https://reddit.com/r/saas')).toBe('ugc')
    expect(classifySidebarBucket('https://www.quora.com/q/123')).toBe('ugc')
    expect(classifySidebarBucket('https://youtube.com/watch?v=abc')).toBe('ugc')
    expect(classifySidebarBucket('https://m.medium.com/@author/post')).toBe('ugc')
  })

  it('detects authoritative hosts and authority TLDs', () => {
    expect(classifySidebarBucket('https://en.wikipedia.org/wiki/X')).toBe('authority')
    expect(classifySidebarBucket('https://www.nytimes.com/section/tech')).toBe('authority')
    expect(classifySidebarBucket('https://www.mit.edu/lab')).toBe('authority')
    expect(classifySidebarBucket('https://cdc.gov/health')).toBe('authority')
    expect(classifySidebarBucket('https://www.ox.ac.uk/about')).toBe('authority')
  })

  it('detects owned-domain when ownedHost matches the URL host (case- and www-insensitive)', () => {
    expect(classifySidebarBucket('https://acme.com/blog/post', 'acme.com')).toBe('owned')
    expect(classifySidebarBucket('https://www.ACME.COM/x', 'acme.com')).toBe('owned')
    expect(classifySidebarBucket('https://docs.acme.com/api', 'acme.com')).toBe('owned')
  })

  it('falls back to other for un-classified hosts', () => {
    expect(classifySidebarBucket('https://random-blog.example.com/post')).toBe('other')
  })

  it('returns other for empty / un-parseable URLs', () => {
    expect(classifySidebarBucket('')).toBe('other')
    expect(classifySidebarBucket('not-a-url-at-all')).toBe('other')
  })

  it('treats owned as the highest-precedence bucket', () => {
    // Pretend an owned domain happens to also be in the UGC set (extreme
    // edge case — a brand whose domain is reddit.com). Owned wins.
    expect(classifySidebarBucket('https://reddit.com/x', 'reddit.com')).toBe('owned')
  })
})

describe('computeSidebarDominance', () => {
  const sample: SidebarRowInput[] = [
    // Mixed sidebar: Reddit + Wikipedia + brand
    {
      id: '1',
      cited_urls: [
        'https://reddit.com/r/saas',
        'https://en.wikipedia.org/wiki/SaaS',
        'https://acme.com/about',
      ],
    },
    // UGC-only
    {
      id: '2',
      cited_urls: ['https://reddit.com/r/x', 'https://youtube.com/watch?v=abc'],
    },
    // Authority-only
    { id: '3', cited_urls: ['https://nytimes.com/section/tech'] },
    // Empty — should be skipped
    { id: '4', cited_urls: [] },
    // Brand-only
    { id: '5', cited_urls: ['https://acme.com/pricing'] },
    // Other-only
    { id: '6', cited_urls: ['https://random-vendor.example/page'] },
  ]

  it('counts total citations and total responses with citations', () => {
    const r = computeSidebarDominance(sample, 'acme.com')
    expect(r.totalCitations).toBe(8)
    expect(r.totalResponses).toBe(5) // 5 rows have ≥1 citation
  })

  it('breaks citations down by bucket and computes share %', () => {
    const r = computeSidebarDominance(sample, 'acme.com')
    expect(r.citations).toEqual({ ugc: 3, authority: 2, owned: 2, other: 1 })
    // ugc: 3/8 = 37.5
    expect(r.citationShare.ugc).toBeCloseTo(37.5, 1)
    expect(r.citationShare.authority).toBeCloseTo(25, 1)
    expect(r.citationShare.owned).toBeCloseTo(25, 1)
    expect(r.citationShare.other).toBeCloseTo(12.5, 1)
  })

  it('reports response coverage — # of responses with ≥1 from each bucket', () => {
    const r = computeSidebarDominance(sample, 'acme.com')
    // ugc: response 1 + response 2 = 2
    // authority: 1 + 3 = 2
    // owned: 1 + 5 = 2
    // other: 6 = 1
    expect(r.responseCoverage).toEqual({ ugc: 2, authority: 2, owned: 2, other: 1 })
  })

  it('computes sidebarScore as % of responses where the brand was cited', () => {
    const r = computeSidebarDominance(sample, 'acme.com')
    // owned in 2 of 5 responses → 40%
    expect(r.sidebarScore).toBeCloseTo(40, 1)
  })

  it('returns 0 sidebarScore when ownedHost is missing', () => {
    const r = computeSidebarDominance(sample, null)
    expect(r.sidebarScore).toBe(0)
    expect(r.citations.owned).toBe(0)
  })

  it('handles an empty input safely', () => {
    const r = computeSidebarDominance([], 'acme.com')
    expect(r.totalCitations).toBe(0)
    expect(r.totalResponses).toBe(0)
    expect(r.sidebarScore).toBe(0)
    expect(r.citationShare).toEqual({ ugc: 0, authority: 0, owned: 0, other: 0 })
  })
})
