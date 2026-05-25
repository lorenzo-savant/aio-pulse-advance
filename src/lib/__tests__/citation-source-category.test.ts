import { describe, it, expect } from 'vitest'
import {
  classifyCitationHost,
  buildCitationSourceBreakdown,
} from '@/lib/utils/citation-source-category'

describe('classifyCitationHost', () => {
  it('classifies G2 / Capterra / Trustpilot as review_site', () => {
    expect(classifyCitationHost('https://g2.com/products/x').category).toBe('review_site')
    expect(classifyCitationHost('https://www.capterra.com/p/x').category).toBe('review_site')
    expect(classifyCitationHost('https://uk.trustpilot.com/review/x').category).toBe('review_site')
  })

  it('classifies Reddit / Quora / StackExchange as community', () => {
    expect(classifyCitationHost('https://reddit.com/r/x').category).toBe('community')
    expect(classifyCitationHost('https://www.quora.com/Q').category).toBe('community')
    expect(classifyCitationHost('https://stackoverflow.com/q').category).toBe('community')
  })

  it('classifies Wikipedia / Britannica as encyclopedia', () => {
    expect(classifyCitationHost('https://en.wikipedia.org/wiki/X').category).toBe('encyclopedia')
    expect(classifyCitationHost('https://www.britannica.com/topic/x').category).toBe('encyclopedia')
  })

  it('classifies Forbes / TechCrunch / NYT as editorial', () => {
    expect(classifyCitationHost('https://forbes.com/sites/x').category).toBe('editorial')
    expect(classifyCitationHost('https://techcrunch.com/x').category).toBe('editorial')
    expect(classifyCitationHost('https://www.nytimes.com/x').category).toBe('editorial')
  })

  it('classifies LinkedIn / YouTube / X as social', () => {
    expect(classifyCitationHost('https://linkedin.com/in/x').category).toBe('social')
    expect(classifyCitationHost('https://www.youtube.com/watch?v=1').category).toBe('social')
    expect(classifyCitationHost('https://x.com/user').category).toBe('social')
  })

  it('classifies Yelp / TripAdvisor as aggregator', () => {
    expect(classifyCitationHost('https://yelp.com/biz/x').category).toBe('aggregator')
    expect(classifyCitationHost('https://www.tripadvisor.com/Hotel_x').category).toBe('aggregator')
  })

  it('flags brand-owned domains as first_party (even on subdomains)', () => {
    expect(classifyCitationHost('https://acme.com/pricing', ['acme.com']).category).toBe(
      'first_party',
    )
    expect(classifyCitationHost('https://blog.acme.com/x', ['acme.com']).category).toBe(
      'first_party',
    )
  })

  it('falls back to other for unknown hosts', () => {
    expect(classifyCitationHost('https://random-blog.example.dev/x').category).toBe('other')
  })

  it('tolerates bare host inputs without protocol', () => {
    expect(classifyCitationHost('g2.com').category).toBe('review_site')
    expect(classifyCitationHost('reddit.com/r/x').category).toBe('community')
  })

  it('returns other and empty host for garbage input', () => {
    const r = classifyCitationHost('')
    expect(r.category).toBe('other')
    expect(r.host).toBe('')
  })
})

describe('buildCitationSourceBreakdown', () => {
  it('aggregates totals and per-category shares', () => {
    const out = buildCitationSourceBreakdown(
      [
        {
          engine: 'chatgpt',
          citedUrls: [
            'https://en.wikipedia.org/x',
            'https://reddit.com/r/x',
            'https://forbes.com/y',
          ],
        },
        { engine: 'perplexity', citedUrls: ['https://g2.com/p', 'https://reddit.com/r/y'] },
      ],
      [],
    )
    expect(out.total).toBe(5)
    const community = out.byCategory.find((c) => c.category === 'community')
    expect(community!.count).toBe(2)
    expect(community!.share).toBeCloseTo(0.4, 5)
    expect(community!.topHosts[0]!.host).toBe('reddit.com')
  })

  it('computes the dominant category per engine', () => {
    const out = buildCitationSourceBreakdown([
      {
        engine: 'chatgpt',
        citedUrls: [
          'https://en.wikipedia.org/a',
          'https://en.wikipedia.org/b',
          'https://reddit.com/x',
        ],
      },
      {
        engine: 'perplexity',
        citedUrls: ['https://g2.com/a', 'https://g2.com/b', 'https://linkedin.com/x'],
      },
    ])
    const chatgpt = out.perEngine.find((e) => e.engine === 'chatgpt')!
    expect(chatgpt.dominant).toBe('encyclopedia')
    expect(chatgpt.dominantShare).toBeCloseTo(2 / 3, 2)
    const perplexity = out.perEngine.find((e) => e.engine === 'perplexity')!
    expect(perplexity.dominant).toBe('review_site')
  })

  it('returns zeroed breakdown for no rows', () => {
    const out = buildCitationSourceBreakdown([])
    expect(out.total).toBe(0)
    expect(out.byCategory.every((c) => c.count === 0)).toBe(true)
    expect(out.perEngine).toEqual([])
  })

  it('flags first-party citations when brand domain provided', () => {
    const out = buildCitationSourceBreakdown(
      [{ engine: 'chatgpt', citedUrls: ['https://acme.com/p', 'https://blog.acme.com/x'] }],
      ['acme.com'],
    )
    const fp = out.byCategory.find((c) => c.category === 'first_party')!
    expect(fp.count).toBe(2)
  })
})
