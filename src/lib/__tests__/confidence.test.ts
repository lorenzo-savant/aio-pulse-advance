import { describe, it, expect } from 'vitest'
import { sampleConfidence } from '../services/confidence'

describe('sampleConfidence', () => {
  it('maps sample size to confidence bands', () => {
    expect(sampleConfidence(0)).toBe('low')
    expect(sampleConfidence(9)).toBe('low')
    expect(sampleConfidence(10)).toBe('medium')
    expect(sampleConfidence(29)).toBe('medium')
    expect(sampleConfidence(30)).toBe('high')
    expect(sampleConfidence(500)).toBe('high')
  })
})
