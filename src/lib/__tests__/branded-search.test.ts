import { describe, it, expect } from 'vitest'
import {
  brandAnchors,
  isBrandedQuery,
  classifyBrandedQueries,
  brandedGrowthRate,
  aiAssistScore,
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

describe('aiAssistScore', () => {
  const tl = (points: Array<{ branded: number; nonBranded: number }>) =>
    points.map((p, i) => ({
      date: `2026-05-0${i + 1}`,
      brandedClicks: 0,
      brandedImpressions: p.branded,
      nonBrandedClicks: 0,
      nonBrandedImpressions: p.nonBranded,
    }))

  it('returns ASSISTED when branded grows much faster than non-branded', () => {
    const timeline = tl([
      { branded: 10, nonBranded: 100 },
      { branded: 10, nonBranded: 100 },
      { branded: 50, nonBranded: 100 },
      { branded: 50, nonBranded: 100 },
    ])
    // branded delta: (100-20)/20 = 400, non-branded: 0 → score 400 clamped to 100
    const a = aiAssistScore(timeline)
    expect(a.verdict).toBe('assisted')
    expect(a.score).toBe(100)
    expect(a.reason).toMatch(/driving direct searches/)
  })

  it('returns CANNIBALISED when non-branded grows much faster than branded', () => {
    const timeline = tl([
      { branded: 100, nonBranded: 10 },
      { branded: 100, nonBranded: 10 },
      { branded: 100, nonBranded: 50 },
      { branded: 100, nonBranded: 50 },
    ])
    // branded delta 0, non-branded delta 400 → score -400 → clamped -100
    const a = aiAssistScore(timeline)
    expect(a.verdict).toBe('cannibalised')
    expect(a.score).toBe(-100)
    expect(a.reason).toMatch(/answering for you/)
  })

  it('returns NEUTRAL when both grow roughly together', () => {
    const timeline = tl([
      { branded: 100, nonBranded: 100 },
      { branded: 100, nonBranded: 100 },
      { branded: 120, nonBranded: 120 },
      { branded: 120, nonBranded: 120 },
    ])
    const a = aiAssistScore(timeline)
    expect(a.verdict).toBe('neutral')
    expect(a.score).toBe(0)
  })

  it('returns UNKNOWN when the timeline is too short', () => {
    const a = aiAssistScore(tl([{ branded: 10, nonBranded: 10 }]))
    expect(a.verdict).toBe('unknown')
    expect(a.score).toBeNull()
  })

  it('handles a zero-baseline branded side without crashing', () => {
    const timeline = tl([
      { branded: 0, nonBranded: 100 },
      { branded: 0, nonBranded: 100 },
      { branded: 50, nonBranded: 100 },
      { branded: 50, nonBranded: 100 },
    ])
    const a = aiAssistScore(timeline)
    // branded delta null (no baseline) → treated as 0; non-branded 0 → score 0 neutral
    expect(a.brandedDeltaPct).toBeNull()
    expect(a.nonBrandedDeltaPct).toBe(0)
    expect(a.verdict).toBe('neutral')
  })
})
