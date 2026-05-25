import { describe, it, expect } from 'vitest'
import {
  brandAnchors,
  isBrandedQuery,
  classifyBrandedQueries,
  brandedGrowthRate,
  type QueryRow,
} from '@/lib/utils/branded-search'

describe('brandAnchors', () => {
  it('collects name, aliases, and domain stem', () => {
    const anchors = brandAnchors({
      name: 'Acasting',
      aliases: ['acasting.se', 'Acasting AB'],
      domain: 'acasting.se',
    })
    expect(anchors).toContain('acasting')
    expect(anchors).toContain('acasting.se')
    expect(anchors).toContain('acasting ab')
  })

  it('drops anchors shorter than 3 chars (avoid stop-word matches)', () => {
    const anchors = brandAnchors({ name: 'AI', aliases: ['ok'], domain: 'ai.se' })
    // "ai" and "ok" both <3 chars, dropped; "ai.se" kept (≥3).
    expect(anchors).not.toContain('ai')
    expect(anchors).not.toContain('ok')
    expect(anchors).toContain('ai.se')
  })

  it('normalises diacritics so "Savànt" matches "savant"', () => {
    const anchors = brandAnchors({ name: 'Savànt Media' })
    expect(anchors).toContain('savant media')
  })

  it('strips www/protocol from the domain anchor', () => {
    const anchors = brandAnchors({ name: 'Acme', domain: 'https://www.acme.com' })
    expect(anchors).toContain('acme.com')
    expect(anchors).toContain('acme')
  })
})

describe('isBrandedQuery', () => {
  const anchors = ['acasting', 'acasting.se']

  it('matches the brand name in the query', () => {
    expect(isBrandedQuery('acasting login', anchors)).toBe(true)
    expect(isBrandedQuery('how does acasting work', anchors)).toBe(true)
    expect(isBrandedQuery('acasting.se prices', anchors)).toBe(true)
  })

  it('matches case- and diacritic-insensitively', () => {
    expect(isBrandedQuery('ACasting reviews', anchors)).toBe(true)
    expect(isBrandedQuery('acàsting prices', anchors)).toBe(true)
  })

  it('does not match queries without the brand', () => {
    expect(isBrandedQuery('best casting platform sweden', anchors)).toBe(false)
    expect(isBrandedQuery('how to find actors', anchors)).toBe(false)
  })

  it('respects word boundaries — short anchors do not bleed into longer words', () => {
    // anchor "ace" (≥3) should NOT match "ace" inside "racecar" or "places".
    const a = ['ace']
    expect(isBrandedQuery('best ace platform', a)).toBe(true)
    expect(isBrandedQuery('great places to visit', a)).toBe(false)
    expect(isBrandedQuery('a racecar', a)).toBe(false)
  })

  it('returns false when anchors is empty', () => {
    expect(isBrandedQuery('anything', [])).toBe(false)
  })
})

describe('classifyBrandedQueries — summary', () => {
  const rows: QueryRow[] = [
    { query: 'acasting login', clicks: 50, impressions: 200, date: '2026-05-01' },
    { query: 'best casting platform', clicks: 10, impressions: 800, date: '2026-05-01' },
    { query: 'acasting price', clicks: 30, impressions: 300, date: '2026-05-02' },
    { query: 'casting jobs sweden', clicks: 5, impressions: 600, date: '2026-05-02' },
    { query: 'acasting login', clicks: 60, impressions: 250, date: '2026-05-03' },
  ]
  const anchors = ['acasting']

  it('aggregates branded vs non-branded clicks and impressions', () => {
    const { summary } = classifyBrandedQueries(rows, anchors)
    expect(summary.branded.clicks).toBe(140) // 50 + 30 + 60
    expect(summary.branded.impressions).toBe(750) // 200 + 300 + 250
    expect(summary.nonBranded.clicks).toBe(15) // 10 + 5
    expect(summary.nonBranded.impressions).toBe(1400)
    expect(summary.total.clicks).toBe(155)
    expect(summary.total.impressions).toBe(2150)
  })

  it('counts unique queries (dedupes same query across days)', () => {
    const { summary } = classifyBrandedQueries(rows, anchors)
    // branded: "acasting login" + "acasting price" → 2 unique
    expect(summary.branded.uniqueQueries).toBe(2)
    // non-branded: "best casting platform" + "casting jobs sweden" → 2
    expect(summary.nonBranded.uniqueQueries).toBe(2)
    expect(summary.total.uniqueQueries).toBe(4)
  })

  it('computes branded share as percentage with 1 decimal', () => {
    const { summary } = classifyBrandedQueries(rows, anchors)
    // 140 / 155 = 90.32… → 90.3
    expect(summary.brandedShareClicks).toBeCloseTo(90.3, 1)
    // 750 / 2150 = 34.88… → 34.9
    expect(summary.brandedShareImpressions).toBeCloseTo(34.9, 1)
  })

  it('handles all-zero rows without dividing by zero', () => {
    const { summary } = classifyBrandedQueries([], anchors)
    expect(summary.brandedShareClicks).toBe(0)
    expect(summary.brandedShareImpressions).toBe(0)
    expect(summary.total.clicks).toBe(0)
  })

  it('treats every query as non-branded when anchors is empty', () => {
    const { summary } = classifyBrandedQueries(rows, [])
    expect(summary.branded.clicks).toBe(0)
    expect(summary.nonBranded.clicks).toBe(155)
  })
})

describe('classifyBrandedQueries — timeline', () => {
  it('aggregates per day, sorted chronologically', () => {
    const rows: QueryRow[] = [
      { query: 'acasting login', clicks: 50, impressions: 200, date: '2026-05-03' },
      { query: 'best casting platform', clicks: 10, impressions: 800, date: '2026-05-01' },
      { query: 'acasting price', clicks: 30, impressions: 300, date: '2026-05-02' },
    ]
    const { timeline } = classifyBrandedQueries(rows, ['acasting'])
    expect(timeline.map((p) => p.date)).toEqual(['2026-05-01', '2026-05-02', '2026-05-03'])
    expect(timeline[0]).toEqual({
      date: '2026-05-01',
      brandedClicks: 0,
      brandedImpressions: 0,
      nonBrandedClicks: 10,
      nonBrandedImpressions: 800,
    })
    expect(timeline[2]?.brandedClicks).toBe(50)
  })
})

describe('brandedGrowthRate', () => {
  it('computes delta % between first and second half of the timeline', () => {
    const timeline = [
      {
        date: '2026-05-01',
        brandedClicks: 10,
        brandedImpressions: 100,
        nonBrandedClicks: 0,
        nonBrandedImpressions: 0,
      },
      {
        date: '2026-05-02',
        brandedClicks: 10,
        brandedImpressions: 100,
        nonBrandedClicks: 0,
        nonBrandedImpressions: 0,
      },
      {
        date: '2026-05-03',
        brandedClicks: 20,
        brandedImpressions: 200,
        nonBrandedClicks: 0,
        nonBrandedImpressions: 0,
      },
      {
        date: '2026-05-04',
        brandedClicks: 20,
        brandedImpressions: 200,
        nonBrandedClicks: 0,
        nonBrandedImpressions: 0,
      },
    ]
    // first half sum: 20 clicks, 200 impressions
    // second half sum: 40 clicks, 400 impressions
    // delta = (40-20)/20 = 100%
    const { clicksDeltaPct, impressionsDeltaPct } = brandedGrowthRate(timeline)
    expect(clicksDeltaPct).toBe(100)
    expect(impressionsDeltaPct).toBe(100)
  })

  it('returns null deltas when the timeline is too short', () => {
    const { clicksDeltaPct, impressionsDeltaPct } = brandedGrowthRate([])
    expect(clicksDeltaPct).toBeNull()
    expect(impressionsDeltaPct).toBeNull()
  })

  it('returns null when the first half has zero clicks (no growth baseline)', () => {
    const timeline = [
      {
        date: '2026-05-01',
        brandedClicks: 0,
        brandedImpressions: 0,
        nonBrandedClicks: 0,
        nonBrandedImpressions: 0,
      },
      {
        date: '2026-05-02',
        brandedClicks: 0,
        brandedImpressions: 0,
        nonBrandedClicks: 0,
        nonBrandedImpressions: 0,
      },
      {
        date: '2026-05-03',
        brandedClicks: 10,
        brandedImpressions: 100,
        nonBrandedClicks: 0,
        nonBrandedImpressions: 0,
      },
      {
        date: '2026-05-04',
        brandedClicks: 10,
        brandedImpressions: 100,
        nonBrandedClicks: 0,
        nonBrandedImpressions: 0,
      },
    ]
    const { clicksDeltaPct } = brandedGrowthRate(timeline)
    expect(clicksDeltaPct).toBeNull()
  })
})
