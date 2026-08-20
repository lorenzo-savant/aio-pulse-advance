import { describe, it, expect } from 'vitest'
import { categoryDrift, classifyCategoryFit } from '../services/category-drift'

describe('categoryDrift', () => {
  it('is 0 when the engine describes the brand in its own category words', () => {
    expect(categoryDrift('price comparison for used goods', 'price comparison for used goods')).toBe(
      0,
    )
  })

  it('is high for the real Relovie case: meta-search described as a used-clothes shop', () => {
    // The finding made measurable: Relovie is a price meta-search across sellers,
    // the engines answer as if it sold second-hand clothing. Every content word
    // differs, so drift is near-total — which is exactly the signal.
    const drift = categoryDrift(
      'second-hand clothing marketplace and used goods retailer',
      'price comparison meta-search across used-goods sellers',
    )
    expect(drift).not.toBeNull()
    expect(drift!).toBeGreaterThan(70)
  })

  it('is moderate when the kind differs but the domain words overlap', () => {
    const drift = categoryDrift('marketplace for used electronics', 'price comparison for used electronics')
    expect(drift!).toBeGreaterThan(0)
    expect(drift!).toBeLessThan(70)
  })

  it('ignores case', () => {
    expect(categoryDrift('PRICE COMPARISON', 'price comparison')).toBe(0)
  })

  it('drops 1-2 char tokens so they do not count as difference', () => {
    // "io"/"di" are 2 chars and dropped; the scoreable words are identical.
    expect(categoryDrift('io price comparison', 'price comparison')).toBe(0)
  })

  it('returns null — not 0 — when a side has no scoreable words', () => {
    expect(categoryDrift('', 'price comparison')).toBeNull()
    expect(categoryDrift('a to of', 'price comparison')).toBeNull()
  })
})

describe('classifyCategoryFit', () => {
  it('buckets by the documented thresholds', () => {
    expect(classifyCategoryFit(0)).toBe('aligned')
    expect(classifyCategoryFit(39)).toBe('aligned')
    expect(classifyCategoryFit(40)).toBe('drifting')
    expect(classifyCategoryFit(69)).toBe('drifting')
    expect(classifyCategoryFit(70)).toBe('mismatch')
    expect(classifyCategoryFit(100)).toBe('mismatch')
  })

  it('reports unknown for a null drift, never folding it into aligned', () => {
    expect(classifyCategoryFit(null)).toBe('unknown')
  })

  it('honours custom thresholds', () => {
    expect(classifyCategoryFit(50, { mismatchAt: 50 })).toBe('mismatch')
  })
})
