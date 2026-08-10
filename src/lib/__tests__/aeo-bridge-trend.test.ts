import { describe, it, expect } from 'vitest'
import { buildAeoReportJson } from '../aeo-bridge'

function result(created_at: string, visibility_score: number) {
  return {
    engine: 'chatgpt',
    visibility_score,
    brand_mentioned: true,
    sentiment_score: 0.5,
    created_at,
  }
}

describe('aeo-bridge trend direction', () => {
  it('reports up when newer rows score higher (desc input)', () => {
    // Input is newest-first, as aggregateBrandData returns (order desc).
    // Older rows (Jan) score low, newer rows (Mar) score high → visibility up.
    const results = [
      result('2026-03-20', 85),
      result('2026-03-10', 80),
      result('2026-02-20', 60),
      result('2026-02-10', 55),
      result('2026-01-20', 40),
      result('2026-01-10', 35),
    ]
    const report = buildAeoReportJson({
      brand: { name: 'Test', domain: null, competitors: [], industry: null, aliases: [] },
      results,
      health: null,
      competitors: [],
      recommendations: [],
      citations: [],
      dateRangeDays: 30,
      trigger: 'manual',
    })
    expect(report.visibility.trend_direction).toBe('up')
  })

  it('reports down when newer rows score lower (desc input)', () => {
    const results = [
      result('2026-03-20', 30),
      result('2026-03-10', 35),
      result('2026-02-20', 60),
      result('2026-02-10', 70),
      result('2026-01-20', 80),
      result('2026-01-10', 85),
    ]
    const report = buildAeoReportJson({
      brand: { name: 'Test', domain: null, competitors: [], industry: null, aliases: [] },
      results,
      health: null,
      competitors: [],
      recommendations: [],
      citations: [],
      dateRangeDays: 30,
      trigger: 'manual',
    })
    expect(report.visibility.trend_direction).toBe('down')
  })
})
