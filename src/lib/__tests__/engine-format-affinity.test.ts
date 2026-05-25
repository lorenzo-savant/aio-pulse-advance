import { describe, it, expect } from 'vitest'
import {
  computeEngineFormatAffinity,
  type FormatAffinityInput,
} from '@/lib/utils/engine-format-affinity'

const sample: FormatAffinityInput[] = [
  // ChatGPT — heavily blog
  {
    engine: 'chatgpt',
    cited_urls: ['https://acme.com/blog/post1', 'https://acme.com/blog/post2'],
  },
  { engine: 'chatgpt', cited_urls: ['https://acme.com/blog/post3'] },
  // Gemini — mixed blog + docs
  { engine: 'gemini', cited_urls: ['https://acme.com/blog/post1'] },
  { engine: 'gemini', cited_urls: ['https://acme.com/docs/install'] },
  // Perplexity — docs-heavy
  {
    engine: 'perplexity',
    cited_urls: ['https://acme.com/docs/api', 'https://acme.com/docs/sdk'],
  },
  { engine: 'perplexity', cited_urls: ['https://acme.com/blog/post1'] },
]

describe('computeEngineFormatAffinity — basic shape', () => {
  it('builds one row per engine with counts and shares', () => {
    const r = computeEngineFormatAffinity(sample)
    expect(r.engines.map((e) => e.engine)).toEqual(['chatgpt', 'perplexity', 'gemini'])
    const chatgpt = r.engines.find((e) => e.engine === 'chatgpt')!
    expect(chatgpt.totalCitations).toBe(3)
    expect(chatgpt.counts.blog).toBe(3)
    expect(chatgpt.shares.blog).toBe(100)
  })

  it('sums totalCitations across all engines × formats', () => {
    const r = computeEngineFormatAffinity(sample)
    expect(r.totalCitations).toBe(8) // 3 chatgpt + 2 gemini + 3 perplexity
  })

  it('shares sum to ~100 per engine (within rounding)', () => {
    const r = computeEngineFormatAffinity(sample)
    for (const e of r.engines) {
      const sum =
        e.shares.blog + e.shares.docs + e.shares.product + e.shares.support + e.shares.other
      expect(Math.abs(sum - 100)).toBeLessThan(0.5)
    }
  })
})

describe('computeEngineFormatAffinity — dominant format per engine', () => {
  it('picks the kind with the highest count per engine', () => {
    const r = computeEngineFormatAffinity(sample)
    expect(r.engines.find((e) => e.engine === 'chatgpt')!.dominantFormat).toBe('blog')
    expect(r.engines.find((e) => e.engine === 'perplexity')!.dominantFormat).toBe('docs')
  })

  it('breaks ties by enumeration order (blog wins a 50/50)', () => {
    const tied: FormatAffinityInput[] = [
      { engine: 'x', cited_urls: ['https://e.com/blog/a', 'https://e.com/docs/a'] },
    ]
    const r = computeEngineFormatAffinity(tied)
    expect(r.engines[0]!.dominantFormat).toBe('blog')
  })

  it('returns null dominantFormat when engine has no citations', () => {
    const empty: FormatAffinityInput[] = [{ engine: 'chatgpt', cited_urls: [] }]
    const r = computeEngineFormatAffinity(empty)
    expect(r.engines[0]!.dominantFormat).toBeNull()
    expect(r.engines[0]!.dominantShare).toBe(0)
  })
})

describe('computeEngineFormatAffinity — format leaders', () => {
  it('identifies the engine that cites each format most heavily', () => {
    const r = computeEngineFormatAffinity(sample)
    const blogLeader = r.formatLeaders.find((f) => f.format === 'blog')!
    // chatgpt has blog share 100%, others lower → chatgpt leads blog.
    expect(blogLeader.leadingEngine).toBe('chatgpt')
    expect(blogLeader.leadingShare).toBe(100)
    expect(blogLeader.total).toBe(5) // 3 chatgpt + 1 gemini + 1 perplexity

    const docsLeader = r.formatLeaders.find((f) => f.format === 'docs')!
    // perplexity has docs share 66.7%, gemini has 50%; perplexity leads.
    expect(docsLeader.leadingEngine).toBe('perplexity')
  })

  it('leader is null for a format nobody cites', () => {
    const noProduct: FormatAffinityInput[] = [
      { engine: 'chatgpt', cited_urls: ['https://acme.com/blog/post'] },
    ]
    const r = computeEngineFormatAffinity(noProduct)
    expect(r.formatLeaders.find((f) => f.format === 'product')!.leadingEngine).toBeNull()
  })
})

describe('computeEngineFormatAffinity — ownedDomain filter', () => {
  it('counts only owned-domain URLs when ownedDomain is set', () => {
    const mixed: FormatAffinityInput[] = [
      {
        engine: 'chatgpt',
        cited_urls: [
          'https://acme.com/blog/post', // owned
          'https://reddit.com/r/saas', // external — should be skipped
          'https://acme.com/docs/api', // owned
        ],
      },
    ]
    const r = computeEngineFormatAffinity(mixed, { ownedDomain: 'acme.com' })
    expect(r.engines[0]!.totalCitations).toBe(2)
    expect(r.engines[0]!.counts.blog).toBe(1)
    expect(r.engines[0]!.counts.docs).toBe(1)
  })

  it('strips www. from ownedDomain', () => {
    const r = computeEngineFormatAffinity(
      [{ engine: 'chatgpt', cited_urls: ['https://www.acme.com/blog/x'] }],
      { ownedDomain: 'www.acme.com' },
    )
    expect(r.engines[0]!.totalCitations).toBe(1)
  })

  it('matches subdomains of the owned root', () => {
    const r = computeEngineFormatAffinity(
      [{ engine: 'chatgpt', cited_urls: ['https://docs.acme.com/blog/x'] }],
      { ownedDomain: 'acme.com' },
    )
    expect(r.engines[0]!.totalCitations).toBe(1)
  })

  it('counts everything when ownedDomain is not provided', () => {
    const r = computeEngineFormatAffinity([
      { engine: 'chatgpt', cited_urls: ['https://acme.com/blog/x', 'https://reddit.com/r/saas'] },
    ])
    expect(r.engines[0]!.totalCitations).toBe(2)
  })
})

describe('computeEngineFormatAffinity — edge cases', () => {
  it('returns empty when there are no rows', () => {
    const r = computeEngineFormatAffinity([])
    expect(r.engines).toEqual([])
    expect(r.formatLeaders.every((f) => f.leadingEngine === null && f.total === 0)).toBe(true)
    expect(r.totalCitations).toBe(0)
  })

  it('labels null/missing engine as "unknown"', () => {
    const r = computeEngineFormatAffinity([
      { engine: null, cited_urls: ['https://acme.com/blog/x'] },
    ])
    expect(r.engines[0]!.engine).toBe('unknown')
  })

  it('ignores non-array / missing cited_urls', () => {
    const r = computeEngineFormatAffinity([{ engine: 'chatgpt', cited_urls: null }])
    expect(r.engines[0]!.totalCitations).toBe(0)
  })
})
