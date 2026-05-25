import { describe, it, expect } from 'vitest'
import {
  computeShareOfVoice,
  computeShareOfVoiceByEngine,
  type SovInputRow,
} from '../services/share-of-voice'

const row = (over: Partial<SovInputRow>): SovInputRow => ({
  brand_mentioned: false,
  mention_count: 0,
  mention_position: null,
  competitor_mentions: [],
  created_at: '2026-05-20T10:00:00Z',
  ...over,
})

describe('computeShareOfVoice', () => {
  it('returns an empty-ish result for no rows', () => {
    const sov = computeShareOfVoice([], 'Acme')
    expect(sov.totalResponses).toBe(0)
    expect(sov.entities).toEqual([
      {
        name: 'Acme',
        isBrand: true,
        mentions: 0,
        share: 0,
        mentionRate: 0,
        avgPosition: null,
        volatility: 0,
        range: { min: 0, max: 0, bucketsObserved: 0 },
      },
    ])
    expect(sov.timeline).toEqual([])
  })

  it('computes share, mention rate, and avg position', () => {
    const rows: SovInputRow[] = [
      row({ brand_mentioned: true, mention_count: 1, mention_position: 1 }),
      row({
        brand_mentioned: true,
        mention_count: 1,
        mention_position: 3,
        competitor_mentions: [{ name: 'Rival', position: 2, count: 1 }],
      }),
      row({ competitor_mentions: [{ name: 'Rival', position: 1, count: 1 }] }),
    ]
    const sov = computeShareOfVoice(rows, 'Acme')
    expect(sov.totalResponses).toBe(3)

    const brand = sov.entities.find((e) => e.isBrand)!
    const rival = sov.entities.find((e) => e.name === 'Rival')!
    // 2 brand mentions, 2 rival mentions → 50/50
    expect(brand.share).toBe(50)
    expect(rival.share).toBe(50)
    // brand mentioned in 2 of 3 responses
    expect(brand.mentionRate).toBeCloseTo(66.7, 1)
    // brand positions 1 and 3 → avg 2
    expect(brand.avgPosition).toBe(2)
    expect(rival.avgPosition).toBe(1.5)
  })

  it('lists the brand first, then competitors by descending mentions', () => {
    const rows: SovInputRow[] = [
      row({ competitor_mentions: [{ name: 'Big', position: 1, count: 5 }] }),
      row({
        brand_mentioned: true,
        mention_count: 1,
        competitor_mentions: [{ name: 'Small', position: 2, count: 1 }],
      }),
    ]
    const sov = computeShareOfVoice(rows, 'Acme')
    expect(sov.entities.map((e) => e.name)).toEqual(['Acme', 'Big', 'Small'])
  })

  it('matches competitor names case-insensitively and never counts the brand as its own competitor', () => {
    const rows: SovInputRow[] = [
      row({
        brand_mentioned: true,
        mention_count: 1,
        competitor_mentions: [
          { name: 'rival', position: 1, count: 1 },
          { name: 'RIVAL', position: 2, count: 1 },
          { name: 'Acme', position: 1, count: 1 }, // self — must be ignored
        ],
      }),
    ]
    const sov = computeShareOfVoice(rows, 'Acme')
    const names = sov.entities.map((e) => e.name)
    expect(names.filter((n) => n.toLowerCase() === 'rival')).toHaveLength(1)
    expect(names.filter((n) => n.toLowerCase() === 'acme')).toHaveLength(1)
    const rival = sov.entities.find((e) => e.name.toLowerCase() === 'rival')!
    expect(rival.mentions).toBe(2) // merged rival + RIVAL
  })

  it('builds a per-day timeline with shares summing to ~100', () => {
    const rows: SovInputRow[] = [
      row({ created_at: '2026-05-19T09:00:00Z', brand_mentioned: true, mention_count: 1 }),
      row({
        created_at: '2026-05-20T09:00:00Z',
        brand_mentioned: true,
        mention_count: 1,
        competitor_mentions: [{ name: 'Rival', position: 1, count: 1 }],
      }),
    ]
    const sov = computeShareOfVoice(rows, 'Acme')
    expect(sov.timeline.map((t) => t.date)).toEqual(['2026-05-19', '2026-05-20'])
    expect(sov.timeline[0]!.shares['Acme']).toBe(100)
    expect(sov.timeline[1]!.shares['Acme']).toBe(50)
    expect(sov.timeline[1]!.shares['Rival']).toBe(50)
  })

  it('per-engine breakdown groups rows by engine and runs SoV per group', () => {
    const rs: SovInputRow[] = [
      row({ engine: 'chatgpt', brand_mentioned: true, mention_count: 1 }),
      row({
        engine: 'chatgpt',
        brand_mentioned: true,
        mention_count: 1,
        competitor_mentions: [{ name: 'Rival', position: 1, count: 1 }],
      }),
      row({
        engine: 'gemini',
        brand_mentioned: false,
        competitor_mentions: [{ name: 'Rival', position: 1, count: 1 }],
      }),
      row({
        engine: 'gemini',
        brand_mentioned: false,
        competitor_mentions: [{ name: 'Rival', position: 1, count: 1 }],
      }),
    ]
    const sov = computeShareOfVoiceByEngine(rs, 'Acme')
    expect(sov.byEngine.map((e) => e.engine)).toEqual(['chatgpt', 'gemini'])

    const chatgpt = sov.byEngine.find((e) => e.engine === 'chatgpt')!
    const gemini = sov.byEngine.find((e) => e.engine === 'gemini')!
    expect(chatgpt.totalResponses).toBe(2)
    expect(gemini.totalResponses).toBe(2)

    const brandOnChatgpt = chatgpt.entities.find((e) => e.isBrand)!
    const brandOnGemini = gemini.entities.find((e) => e.isBrand)!
    // chatgpt: 2 brand, 1 rival → brand share 66.7%
    expect(brandOnChatgpt.share).toBeCloseTo(66.7, 1)
    // gemini: 0 brand, 2 rival → brand share 0%
    expect(brandOnGemini.share).toBe(0)

    // Overall = aggregate as if engine grouping didn't exist.
    expect(sov.overall.totalResponses).toBe(4)
    const overallBrand = sov.overall.entities.find((e) => e.isBrand)!
    expect(overallBrand.mentions).toBe(2)
  })

  it('per-engine sorts engines by response volume (most-monitored first)', () => {
    const rs: SovInputRow[] = [
      row({ engine: 'gemini', brand_mentioned: true, mention_count: 1 }),
      row({ engine: 'chatgpt', brand_mentioned: true, mention_count: 1 }),
      row({ engine: 'chatgpt', brand_mentioned: true, mention_count: 1 }),
      row({ engine: 'chatgpt', brand_mentioned: true, mention_count: 1 }),
    ]
    const sov = computeShareOfVoiceByEngine(rs, 'Acme')
    // chatgpt has 3 responses, gemini 1 → chatgpt first
    expect(sov.byEngine.map((e) => e.engine)).toEqual(['chatgpt', 'gemini'])
  })

  it('per-engine labels null/missing engine as "unknown"', () => {
    const rs: SovInputRow[] = [
      row({ engine: null, brand_mentioned: true, mention_count: 1 }),
      row({ brand_mentioned: true, mention_count: 1 }), // engine field absent
    ]
    const sov = computeShareOfVoiceByEngine(rs, 'Acme')
    expect(sov.byEngine).toHaveLength(1)
    expect(sov.byEngine[0]!.engine).toBe('unknown')
    expect(sov.byEngine[0]!.totalResponses).toBe(2)
  })

  it('reports zero volatility when an entity appears in a single bucket', () => {
    const rows: SovInputRow[] = [
      row({
        created_at: '2026-05-20T09:00:00Z',
        brand_mentioned: true,
        mention_count: 1,
        competitor_mentions: [{ name: 'Rival', position: 1, count: 1 }],
      }),
    ]
    const sov = computeShareOfVoice(rows, 'Acme')
    const brand = sov.entities.find((e) => e.isBrand)!
    // Only one day → share is the only observation, volatility 0, min=max=50.
    expect(brand.volatility).toBe(0)
    expect(brand.range).toEqual({ min: 50, max: 50, bucketsObserved: 1 })
  })

  it('computes per-entity volatility, min, and max across buckets', () => {
    // Day 1: brand 100% (2 brand mentions, 0 rival)
    // Day 2: brand   0% (0 brand, 2 rival)
    // Day 3: brand  50% (1 brand, 1 rival)
    // Series for brand = [100, 0, 50]; mean=50, variance=1666.67, stddev≈40.8.
    const rows: SovInputRow[] = [
      row({ created_at: '2026-05-20T09:00:00Z', brand_mentioned: true, mention_count: 2 }),
      row({
        created_at: '2026-05-21T09:00:00Z',
        competitor_mentions: [{ name: 'Rival', position: 1, count: 2 }],
      }),
      row({
        created_at: '2026-05-22T09:00:00Z',
        brand_mentioned: true,
        mention_count: 1,
        competitor_mentions: [{ name: 'Rival', position: 1, count: 1 }],
      }),
    ]
    const sov = computeShareOfVoice(rows, 'Acme')
    const brand = sov.entities.find((e) => e.isBrand)!
    expect(brand.range.bucketsObserved).toBe(3)
    expect(brand.range.min).toBe(0)
    expect(brand.range.max).toBe(100)
    expect(brand.volatility).toBeGreaterThan(40)
    expect(brand.volatility).toBeLessThan(42)
  })

  it('volatility ignores buckets where the entity never appeared (no zero-stuffing)', () => {
    // Brand-only days, two buckets — brand share is 100% on both, volatility 0.
    const rows: SovInputRow[] = [
      row({ created_at: '2026-05-20T09:00:00Z', brand_mentioned: true, mention_count: 1 }),
      row({ created_at: '2026-05-21T09:00:00Z', brand_mentioned: true, mention_count: 1 }),
    ]
    const sov = computeShareOfVoice(rows, 'Acme')
    const brand = sov.entities.find((e) => e.isBrand)!
    expect(brand.volatility).toBe(0)
    expect(brand.range).toEqual({ min: 100, max: 100, bucketsObserved: 2 })
  })

  it('caps the timeline series to brand + top N competitors', () => {
    const rows: SovInputRow[] = [
      row({
        brand_mentioned: true,
        mention_count: 1,
        competitor_mentions: [
          { name: 'C1', position: 1, count: 6 },
          { name: 'C2', position: 1, count: 5 },
          { name: 'C3', position: 1, count: 4 },
          { name: 'C4', position: 1, count: 3 },
          { name: 'C5', position: 1, count: 2 },
          { name: 'C6', position: 1, count: 1 },
        ],
      }),
    ]
    const sov = computeShareOfVoice(rows, 'Acme', { maxSeries: 3 })
    // brand + top 3 competitors = 4 series; C6 excluded
    expect(sov.series).toEqual(['Acme', 'C1', 'C2', 'C3'])
    // but entities still lists everyone
    expect(sov.entities).toHaveLength(7)
  })
})
