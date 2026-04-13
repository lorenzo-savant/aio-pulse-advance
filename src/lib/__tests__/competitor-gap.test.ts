import { describe, it, expect } from 'vitest'
import { calculateCompetitorAVI } from '../services/monitoring'

describe('calculateCompetitorAVI', () => {
  it('returns rank 0 and avi 0 for empty mentions', () => {
    const result = calculateCompetitorAVI([], 50)
    expect(result.rank).toBe(0)
    expect(result.competitorAvi).toBe(0)
    expect(result.weakestComponent).toBe('mentionFrequency')
  })

  it('calculates correct competitor AVI and rank 1 when competitor AVI >= brand AVI', () => {
    const mentions = [
      { name: 'CompetitorA', position: 1, count: 10 },
      { name: 'CompetitorB', position: 2, count: 5 },
    ]
    const result = calculateCompetitorAVI(mentions, 30)
    expect(result.competitorAvi).toBeGreaterThan(30)
    expect(result.rank).toBe(1)
  })

  it('calculates rank 2 when gap is moderate', () => {
    const mentions = [{ name: 'CompetitorA', position: 3, count: 2 }]
    const result = calculateCompetitorAVI(mentions, 80)
    expect(result.rank).toBe(2)
  })

  it('calculates rank 3 when gap is large', () => {
    const mentions = [{ name: 'CompetitorA', position: 5, count: 1 }]
    const result = calculateCompetitorAVI(mentions, 90)
    expect(result.rank).toBe(3)
  })

  it('identifies weakest component correctly', () => {
    const mentions = [{ name: 'CompetitorA', position: 5, count: 1 }]
    const result = calculateCompetitorAVI(mentions, 50)
    expect(result.weakestComponent).toBeDefined()
  })

  it('handles mentions with zero count', () => {
    const mentions = [
      { name: 'CompetitorA', position: 1, count: 0 },
      { name: 'CompetitorB', position: 2, count: 5 },
    ]
    const result = calculateCompetitorAVI(mentions, 30)
    expect(result.competitorAvi).toBeGreaterThan(0)
  })
})
