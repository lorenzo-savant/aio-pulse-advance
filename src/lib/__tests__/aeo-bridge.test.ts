import { describe, it, expect } from 'vitest'
import {
  calcVisibilityScore,
  calcMentionRate,
  calcOverallSentiment,
  calcCompleteness,
  buildAeoReportJson,
  aggregateByEngine,
  calcSentimentBreakdown,
} from '../aeo-bridge'

describe('calcVisibilityScore', () => {
  it('returns 0 for empty array', () => {
    expect(calcVisibilityScore([])).toBe(0)
  })

  it('calculates average visibility score correctly', () => {
    const results = [{ visibility_score: 80 }, { visibility_score: 60 }]
    expect(calcVisibilityScore(results)).toBe(70)
  })

  it('handles results with missing visibility_score', () => {
    const results = [{ visibility_score: 80 }, { some_other_field: 'test' }]
    expect(calcVisibilityScore(results)).toBe(40)
  })
})

describe('calcMentionRate', () => {
  it('returns 0 for empty array', () => {
    expect(calcMentionRate([])).toBe(0)
  })

  it('calculates mention rate correctly', () => {
    const results = [{ brand_mentioned: true }, { brand_mentioned: false }]
    expect(calcMentionRate(results)).toBe(50)
  })

  it('handles all mentioned', () => {
    const results = [
      { brand_mentioned: true },
      { brand_mentioned: true },
      { brand_mentioned: true },
    ]
    expect(calcMentionRate(results)).toBe(100)
  })

  it('handles none mentioned', () => {
    const results = [{ brand_mentioned: false }, { brand_mentioned: false }]
    expect(calcMentionRate(results)).toBe(0)
  })
})

describe('calcOverallSentiment', () => {
  it('returns neutral for empty array', () => {
    const result = calcOverallSentiment([])
    expect(result.overall).toBe('neutral')
    expect(result.score).toBe(0)
  })

  it('calculates positive sentiment correctly', () => {
    const results = [{ sentiment_score: 0.5 }, { sentiment_score: 0.3 }]
    const result = calcOverallSentiment(results)
    expect(result.overall).toBe('positive')
    expect(result.score).toBe(0.4)
  })

  it('calculates negative sentiment correctly', () => {
    const results = [{ sentiment_score: -0.5 }, { sentiment_score: -0.3 }]
    const result = calcOverallSentiment(results)
    expect(result.overall).toBe('negative')
    expect(result.score).toBe(-0.4)
  })

  it('returns neutral for near-zero scores', () => {
    const results = [{ sentiment_score: 0.05 }, { sentiment_score: -0.05 }]
    const result = calcOverallSentiment(results)
    expect(result.overall).toBe('neutral')
  })
})

describe('calcCompleteness', () => {
  it('returns 0 for empty data', () => {
    const result = calcCompleteness({}, [], null, [], [], [])
    expect(result).toBe(0)
  })

  it('returns 100 for complete data', () => {
    const brand = { domain: 'example.com', name: 'Test' }
    const results = Array(10).fill({})
    const health = { visibility_score: 80 }
    const competitors = [{}]
    const citations = [{}]
    const recommendations = [{}]

    const result = calcCompleteness(brand, results, health, competitors, citations, recommendations)
    expect(result).toBe(100)
  })

  it('calculates partial scores correctly', () => {
    const brand = { domain: 'example.com' }
    const results = [{}]
    const result = calcCompleteness(brand, results, null, [], [], [])
    expect(result).toBe(40) // 15 (domain) + 25 (results)
  })
})

describe('aggregateByEngine', () => {
  it('groups results by engine', () => {
    const results = [
      { engine: 'chatgpt', visibility_score: 80, brand_mentioned: true },
      { engine: 'chatgpt', visibility_score: 60, brand_mentioned: false },
      { engine: 'gemini', visibility_score: 70, brand_mentioned: true },
    ]

    const result = aggregateByEngine(results)

    expect(result.chatgpt!.score).toBe(70)
    expect(result.chatgpt!.mention_rate).toBe(50)
    expect(result.chatgpt!.scan_count).toBe(2)
    expect(result.gemini!.score).toBe(70)
    expect(result.gemini!.mention_rate).toBe(100)
    expect(result.gemini!.scan_count).toBe(1)
  })

  it('handles missing engine field', () => {
    const results = [{ visibility_score: 80 }, { engine: 'chatgpt', visibility_score: 60 }]

    const result = aggregateByEngine(results)

    expect(result.unknown!.score).toBe(80)
    expect(result.chatgpt!.score).toBe(60)
  })
})

describe('calcSentimentBreakdown', () => {
  it('calculates breakdown correctly', () => {
    const results = [
      { sentiment: 'positive' },
      { sentiment: 'positive' },
      { sentiment: 'negative' },
      { sentiment: 'neutral' },
    ]

    const result = calcSentimentBreakdown(results)

    expect(result.positive).toBe(2)
    expect(result.negative).toBe(1)
    expect(result.neutral).toBe(1)
  })
})

describe('buildAeoReportJson', () => {
  it('builds correct report structure', () => {
    const brand = {
      id: '123',
      name: 'Test Brand',
      domain: 'test.com',
      competitors: ['comp1'],
      industry: 'tech',
      aliases: ['alias1'],
    }
    const results = [
      {
        engine: 'chatgpt',
        visibility_score: 80,
        brand_mentioned: true,
        sentiment_score: 0.5,
        created_at: '2024-01-01',
      },
      {
        engine: 'gemini',
        visibility_score: 70,
        brand_mentioned: true,
        sentiment_score: 0.3,
        created_at: '2024-01-02',
      },
    ]
    const health = { visibility_score: 75 }
    const competitors = [{ name: 'Comp1', domain: 'comp1.com', visibility_score: 60 }]
    const recommendations = [
      {
        id: '1',
        type: 'content',
        priority: 'high',
        title: 'Test',
        description: 'Test rec',
        status: 'pending',
      },
    ]
    const citations = [
      { url: 'https://test.com', domain: 'test.com', mention_count: 5, citation_type: 'organic' },
    ]

    const report = buildAeoReportJson({
      brand,
      results,
      health,
      competitors,
      recommendations,
      citations,
      dateRangeDays: 30,
      trigger: 'manual',
    })

    expect(report.meta.client).toBe('Test Brand')
    expect(report.meta.domain).toBe('test.com')
    expect(report.visibility.ai_score).toBe(75)
    expect(report.visibility.mention_rate).toBe(100)
    expect(report.visibility.total_scans).toBe(2)
    expect(report.sentiment.overall).toBe('positive')
    expect(report.competitors).toHaveLength(1)
    expect(report.citations).toHaveLength(1)
    expect(report.recommendations).toHaveLength(1)
  })

  it('handles empty data gracefully', () => {
    const brand = { name: 'Test', domain: null, competitors: [], industry: null, aliases: [] }

    const report = buildAeoReportJson({
      brand,
      results: [],
      health: null,
      competitors: [],
      recommendations: [],
      citations: [],
      dateRangeDays: 30,
      trigger: 'manual',
    })

    expect(report.visibility.ai_score).toBe(0)
    expect(report.visibility.mention_rate).toBe(0)
    expect(report.meta.completeness_score).toBe(0)
  })
})
