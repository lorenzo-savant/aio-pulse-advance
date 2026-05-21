import { describe, it, expect } from 'vitest'
import { classifyMarketPosition, type MarketPositionInput } from '../services/market-position'

const base: MarketPositionInput = {
  share: 20,
  rank: 2,
  entityCount: 4,
  momentum: 0,
  avgSentiment: 0,
  totalResponses: 50,
}

describe('classifyMarketPosition — category role', () => {
  it('Leader: rank 1 with dominant share', () => {
    expect(classifyMarketPosition({ ...base, rank: 1, share: 45 }).categoryRole).toBe('leader')
  })

  it('Challenger: top-3 with meaningful share', () => {
    expect(classifyMarketPosition({ ...base, rank: 2, share: 18 }).categoryRole).toBe('challenger')
  })

  it('Niche: low share / low rank', () => {
    expect(classifyMarketPosition({ ...base, rank: 6, share: 4 }).categoryRole).toBe('niche')
  })

  it('rank 1 but weak share is not auto-Leader', () => {
    expect(classifyMarketPosition({ ...base, rank: 1, share: 18 }).categoryRole).toBe('challenger')
  })

  it('no competitors → leader but flagged low-signal in reasoning', () => {
    const mp = classifyMarketPosition({ ...base, entityCount: 1, rank: 1, share: 100 })
    expect(mp.categoryRole).toBe('leader')
    expect(mp.reasoning).toMatch(/no competitors detected/i)
  })
})

describe('classifyMarketPosition — innovation perception', () => {
  it('Disruptor: strong positive momentum', () => {
    expect(classifyMarketPosition({ ...base, momentum: 12 }).innovationPerception).toBe('disruptor')
  })

  it('Innovator: strongly positive sentiment, flat momentum', () => {
    expect(
      classifyMarketPosition({ ...base, avgSentiment: 0.5, momentum: 0 }).innovationPerception,
    ).toBe('innovator')
  })

  it('Disruptor: mild momentum even with neutral sentiment', () => {
    expect(
      classifyMarketPosition({ ...base, momentum: 4, avgSentiment: 0 }).innovationPerception,
    ).toBe('disruptor')
  })

  it('Traditionalist: flat momentum, modest sentiment', () => {
    expect(
      classifyMarketPosition({ ...base, momentum: 1, avgSentiment: 0.1 }).innovationPerception,
    ).toBe('traditionalist')
  })
})

describe('classifyMarketPosition — confidence + reasoning', () => {
  it('confidence scales with responses', () => {
    expect(classifyMarketPosition({ ...base, totalResponses: 5 }).confidence).toBe('low')
    expect(classifyMarketPosition({ ...base, totalResponses: 20 }).confidence).toBe('medium')
    expect(classifyMarketPosition({ ...base, totalResponses: 40 }).confidence).toBe('high')
  })

  it('reasoning cites the numbers behind the labels', () => {
    const mp = classifyMarketPosition({
      ...base,
      share: 30,
      rank: 1,
      momentum: 5,
      avgSentiment: 0.4,
    })
    expect(mp.reasoning).toContain('30% share of voice')
    expect(mp.reasoning).toContain('rank #1 of 4')
    expect(mp.reasoning).toMatch(/sentiment \+0\.4/)
  })

  it('low responses adds a provisional caveat', () => {
    expect(classifyMarketPosition({ ...base, totalResponses: 6 }).reasoning).toMatch(/provisional/i)
  })
})
