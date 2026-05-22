import { describe, it, expect } from 'vitest'
import { cosineSimilarity, mostSimilar, type EmbeddedItem } from '../services/semantic'

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6)
  })

  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6)
  })

  it('is -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1, 6)
  })

  it('reflects partial similarity', () => {
    const s = cosineSimilarity([1, 1, 0], [1, 1, 1])
    expect(s).toBeGreaterThan(0.7)
    expect(s).toBeLessThan(1)
  })

  it('returns 0 on bad/empty/mismatched input', () => {
    expect(cosineSimilarity([], [])).toBe(0)
    expect(cosineSimilarity([1, 2], [1])).toBe(0)
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0)
  })
})

describe('mostSimilar', () => {
  const candidates: EmbeddedItem[] = [
    { id: 'a', text: 'alpha', embedding: [1, 0, 0] },
    { id: 'b', text: 'beta', embedding: [0, 1, 0] },
    { id: 'c', text: 'gamma', embedding: [0.9, 0.1, 0] },
  ]

  it('finds the closest candidate with a rounded score', () => {
    const r = mostSimilar([1, 0, 0], candidates)
    expect(r?.id).toBe('a')
    expect(r?.score).toBe(1)
  })

  it('picks the near-duplicate over the orthogonal one', () => {
    const r = mostSimilar([0.95, 0.05, 0], candidates)
    expect(r?.id).toBe('a') // closer to alpha/gamma than beta
    expect(r!.score).toBeGreaterThan(0.9)
  })

  it('returns null for empty target or candidates', () => {
    expect(mostSimilar([], candidates)).toBeNull()
    expect(mostSimilar([1, 0, 0], [])).toBeNull()
  })
})
