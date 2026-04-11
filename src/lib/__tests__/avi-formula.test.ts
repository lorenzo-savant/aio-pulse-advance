import { describe, it, expect } from 'vitest'
import { calculateAVI, calculateAVIFromResults, type AVIInput } from '../services/monitoring'

describe('calculateAVI', () => {
  it('returns low score for all-zero input', () => {
    const input: AVIInput = {
      citationRate: 0,
      mentionFrequency: 0,
      sentimentScore: 0,
      recommendationRate: 0,
      positionAvg: 0,
      hallucinationIndex: 0,
    }
    const avi = calculateAVI(input)
    expect(avi).toBeLessThan(30)
  })

  it('returns score near 100 for perfect input', () => {
    const input: AVIInput = {
      citationRate: 100,
      mentionFrequency: 100,
      sentimentScore: 1,
      recommendationRate: 100,
      positionAvg: 1,
      hallucinationIndex: 0,
    }
    const avi = calculateAVI(input)
    expect(avi).toBeGreaterThan(95)
    expect(avi).toBeLessThanOrEqual(100)
  })

  it('returns mid-range score for mid-range input', () => {
    const input: AVIInput = {
      citationRate: 50,
      mentionFrequency: 50,
      sentimentScore: 0,
      recommendationRate: 50,
      positionAvg: 3,
      hallucinationIndex: 50,
    }
    const avi = calculateAVI(input)
    expect(avi).toBeGreaterThanOrEqual(30)
    expect(avi).toBeLessThanOrEqual(70)
  })

  it('handles boundary values correctly', () => {
    const input: AVIInput = {
      citationRate: 100,
      mentionFrequency: 100,
      sentimentScore: 1,
      recommendationRate: 100,
      positionAvg: 5,
      hallucinationIndex: 100,
    }
    const avi = calculateAVI(input)
    expect(avi).toBeLessThan(100)
    expect(avi).toBeGreaterThan(0)
  })
})

describe('calculateAVIFromResults', () => {
  it('returns avi 0 for empty results array', () => {
    const { avi, components } = calculateAVIFromResults([])
    expect(avi).toBe(0)
    expect(components.citationRate).toBe(0)
    expect(components.mentionFrequency).toBe(0)
    expect(components.sentimentScore).toBe(0)
    expect(components.recommendationRate).toBe(0)
    expect(components.positionAvg).toBe(0)
    expect(components.hallucinationIndex).toBe(0)
  })

  it('calculates correct components from results', () => {
    const results = [
      {
        brand_mentioned: true,
        visibility_score: 80,
        sentiment_score: 0.5,
        cited_urls: ['https://example.com'],
        has_hallucination: false,
        mention_position: 1,
      },
      {
        brand_mentioned: true,
        visibility_score: 60,
        sentiment_score: -0.3,
        cited_urls: [],
        has_hallucination: true,
        mention_position: 2,
      },
      {
        brand_mentioned: false,
        visibility_score: 40,
        sentiment_score: null,
        cited_urls: [],
        has_hallucination: false,
        mention_position: null,
      },
    ]
    const { avi, components } = calculateAVIFromResults(results)
    expect(components.citationRate).toBeCloseTo(33.33, 1)
    expect(components.mentionFrequency).toBeCloseTo(66.67, 1)
    expect(components.hallucinationIndex).toBeCloseTo(33.33, 1)
    expect(avi).toBeGreaterThan(0)
    expect(avi).toBeLessThan(100)
  })
})
