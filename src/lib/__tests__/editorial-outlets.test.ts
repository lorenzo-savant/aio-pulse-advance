import { describe, it, expect } from 'vitest'
import { buildEditorialOutletLeaderboard } from '@/lib/utils/editorial-outlets'

describe('buildEditorialOutletLeaderboard', () => {
  it('returns an empty leaderboard when no rows are supplied', () => {
    const out = buildEditorialOutletLeaderboard([])
    expect(out.outlets).toEqual([])
    expect(out.totalEditorialCitations).toBe(0)
    expect(out.engines).toEqual([])
  })

  it('only counts hosts in the editorial bucket — community/review/social are ignored', () => {
    const out = buildEditorialOutletLeaderboard([
      {
        engine: 'chatgpt',
        citedUrls: [
          'https://forbes.com/sites/a', // editorial
          'https://reddit.com/r/x', // community → skipped
          'https://g2.com/p', // review_site → skipped
        ],
      },
    ])
    expect(out.totalEditorialCitations).toBe(1)
    expect(out.outlets).toHaveLength(1)
    expect(out.outlets[0]!.host).toBe('forbes.com')
  })

  it('aggregates per-host counts and computes share of the editorial pool', () => {
    const out = buildEditorialOutletLeaderboard([
      {
        engine: 'chatgpt',
        citedUrls: [
          'https://forbes.com/a',
          'https://forbes.com/b',
          'https://techcrunch.com/c',
          'https://nytimes.com/d',
        ],
      },
    ])
    expect(out.totalEditorialCitations).toBe(4)
    const forbes = out.outlets.find((o) => o.host === 'forbes.com')!
    expect(forbes.count).toBe(2)
    expect(forbes.share).toBeCloseTo(0.5, 5)
  })

  it('sorts outlets by count then by engine coverage then by host', () => {
    const out = buildEditorialOutletLeaderboard([
      // forbes: 2 citations, 1 engine
      {
        engine: 'chatgpt',
        citedUrls: ['https://forbes.com/a', 'https://forbes.com/b'],
      },
      // techcrunch: 2 citations, 2 engines (wider coverage → wins the tie)
      { engine: 'chatgpt', citedUrls: ['https://techcrunch.com/a'] },
      { engine: 'perplexity', citedUrls: ['https://techcrunch.com/b'] },
      // verge: 1 citation
      { engine: 'gemini', citedUrls: ['https://theverge.com/c'] },
    ])
    expect(out.outlets.map((o) => o.host)).toEqual(['techcrunch.com', 'forbes.com', 'theverge.com'])
  })

  it('per-engine breakdown is sorted by count desc then by engine name', () => {
    const out = buildEditorialOutletLeaderboard([
      { engine: 'perplexity', citedUrls: ['https://forbes.com/a'] },
      { engine: 'chatgpt', citedUrls: ['https://forbes.com/b', 'https://forbes.com/c'] },
      { engine: 'gemini', citedUrls: ['https://forbes.com/d'] },
    ])
    const forbes = out.outlets[0]!
    expect(forbes.host).toBe('forbes.com')
    expect(forbes.perEngine.map((e) => e.engine)).toEqual(['chatgpt', 'gemini', 'perplexity'])
    expect(forbes.engineCoverage).toBe(3)
  })

  it('honours the limit option (default 15, custom enforced)', () => {
    const rows = [
      // 20 distinct editorial hosts, each cited once
      ...Array.from({ length: 20 }).map((_, i) => ({
        engine: 'chatgpt',
        citedUrls: [`https://forbes.com/${i}`],
      })),
      ...Array.from({ length: 5 }).map((_, i) => ({
        engine: 'chatgpt',
        citedUrls: [`https://techcrunch.com/${i}`],
      })),
    ]
    const def = buildEditorialOutletLeaderboard(rows)
    // Only 2 distinct editorial hosts in this fixture, so the cap doesn't bite.
    expect(def.outlets).toHaveLength(2)
    const capped = buildEditorialOutletLeaderboard(rows, { limit: 1 })
    expect(capped.outlets).toHaveLength(1)
    expect(capped.outlets[0]!.host).toBe('forbes.com')
  })

  it('excludes brand-owned editorial-looking hosts (first_party)', () => {
    // techcrunch.com is in the editorial bucket by default — but if the
    // brand owns it, it must NOT show up in the editorial leaderboard.
    const out = buildEditorialOutletLeaderboard(
      [
        {
          engine: 'chatgpt',
          citedUrls: ['https://techcrunch.com/blog/a', 'https://forbes.com/b'],
        },
      ],
      { brandDomains: ['techcrunch.com'] },
    )
    expect(out.outlets.map((o) => o.host)).toEqual(['forbes.com'])
    expect(out.totalEditorialCitations).toBe(1)
  })

  it('returns the distinct set of engines that contributed editorial citations', () => {
    const out = buildEditorialOutletLeaderboard([
      { engine: 'chatgpt', citedUrls: ['https://forbes.com/a'] },
      { engine: 'perplexity', citedUrls: ['https://reddit.com/x'] }, // not editorial → skipped
      { engine: 'gemini', citedUrls: ['https://nytimes.com/y'] },
    ])
    // perplexity only had a non-editorial URL so it doesn't appear.
    expect(out.engines).toEqual(['chatgpt', 'gemini'])
  })
})
