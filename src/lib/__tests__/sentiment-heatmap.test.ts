import { describe, it, expect } from 'vitest'
import { buildSentimentHeatmap, type SentimentHeatmap } from '../services/monitoring'

const mockResults = [
  {
    engine: 'chatgpt',
    category: 'discovery',
    brand_mentioned: true,
    sentiment_score: 0.8,
    visibility_score: 90,
    cited_urls: ['https://example.com'],
    has_hallucination: false,
    mention_position: 1,
  },
  {
    engine: 'chatgpt',
    category: 'discovery',
    brand_mentioned: true,
    sentiment_score: 0.5,
    visibility_score: 70,
    cited_urls: [],
    has_hallucination: false,
    mention_position: 2,
  },
  {
    engine: 'chatgpt',
    category: 'comparison',
    brand_mentioned: false,
    sentiment_score: null,
    visibility_score: 50,
    cited_urls: [],
    has_hallucination: false,
    mention_position: null,
  },
  {
    engine: 'gemini',
    category: 'discovery',
    brand_mentioned: true,
    sentiment_score: -0.3,
    visibility_score: 60,
    cited_urls: ['https://test.com'],
    has_hallucination: true,
    mention_position: 3,
  },
  {
    engine: 'gemini',
    category: 'comparison',
    brand_mentioned: true,
    sentiment_score: 0.2,
    visibility_score: 80,
    cited_urls: [],
    has_hallucination: false,
    mention_position: 1,
  },
  {
    engine: 'perplexity',
    category: null,
    brand_mentioned: true,
    sentiment_score: 0.6,
    visibility_score: 85,
    cited_urls: ['https://docs.com'],
    has_hallucination: false,
    mention_position: 1,
  },
]

describe('buildSentimentHeatmap', () => {
  it('returns empty heatmap for empty results array', () => {
    const heatmap = buildSentimentHeatmap([])
    expect(heatmap).toEqual({})
  })

  it('aggregates results by engine and category', () => {
    const heatmap = buildSentimentHeatmap(mockResults)

    expect(heatmap['chatgpt']).toBeDefined()
    expect(heatmap['gemini']).toBeDefined()
    expect(heatmap['perplexity']).toBeDefined()
  })

  it('calculates correct sentiment average per cell', () => {
    const heatmap = buildSentimentHeatmap(mockResults)

    const chatgptDiscovery = heatmap['chatgpt']?.['discovery']
    expect(chatgptDiscovery).toBeDefined()
    expect(chatgptDiscovery?.sentiment).toBeCloseTo(0.65, 2)
  })

  it('counts mentions correctly per cell', () => {
    const heatmap = buildSentimentHeatmap(mockResults)

    const chatgptDiscovery = heatmap['chatgpt']?.['discovery']
    expect(chatgptDiscovery?.mentions).toBe(2)

    const chatgptComparison = heatmap['chatgpt']?.['comparison']
    expect(chatgptComparison?.mentions).toBe(0)
  })

  it('calculates AVI per cell', () => {
    const heatmap = buildSentimentHeatmap(mockResults)

    const chatgptDiscovery = heatmap['chatgpt']?.['discovery']
    expect(chatgptDiscovery?.avi).toBeGreaterThan(0)
    expect(chatgptDiscovery?.avi).toBeLessThanOrEqual(100)
  })

  it('handles null category as uncategorized', () => {
    const heatmap = buildSentimentHeatmap(mockResults)

    const perplexityUncategorized = heatmap['perplexity']?.['uncategorized']
    expect(perplexityUncategorized).toBeDefined()
    expect(perplexityUncategorized?.mentions).toBe(1)
  })

  it('produces valid heatmap structure', () => {
    const heatmap = buildSentimentHeatmap(mockResults) as SentimentHeatmap

    for (const engine of Object.values(heatmap)) {
      for (const cell of Object.values(engine)) {
        expect(typeof cell.sentiment).toBe('number')
        expect(typeof cell.mentions).toBe('number')
        expect(typeof cell.avi).toBe('number')
        expect(cell.sentiment).toBeGreaterThanOrEqual(-1)
        expect(cell.sentiment).toBeLessThanOrEqual(1)
        expect(cell.mentions).toBeGreaterThanOrEqual(0)
        expect(cell.avi).toBeGreaterThanOrEqual(0)
        expect(cell.avi).toBeLessThanOrEqual(100)
      }
    }
  })
})
