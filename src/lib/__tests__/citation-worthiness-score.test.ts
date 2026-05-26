import { describe, it, expect } from 'vitest'
import {
  computeCitationWorthinessScore,
  type CitationWorthinessSignals,
} from '../utils/citation-worthiness-score'

const baseSignals: CitationWorthinessSignals = {
  schemaValid: true,
  schemaTypeCount: 3,
  aiCrawlersAllowed: true,
  daysSinceUpdate: 15,
  aiCitationCount: 8,
  aiEnginesCiting: 3,
  brandMentioned: true,
  hallucinationFlagged: false,
  wordCount: 1200,
  inboundInternalLinks: 4,
}

describe('computeCitationWorthinessScore', () => {
  it('rewards a fully-optimised page with a strong/excellent score', () => {
    const r = computeCitationWorthinessScore(baseSignals)
    expect(r.score).toBeGreaterThanOrEqual(80)
    expect(['strong', 'excellent']).toContain(r.band)
  })

  it('zeros the crawlability pillar when AI crawlers are blocked', () => {
    const r = computeCitationWorthinessScore({ ...baseSignals, aiCrawlersAllowed: false })
    expect(r.components.crawlability).toBe(0)
    // Recommendation must call this out FIRST — it's the hardest gap.
    expect(r.recommendations[0]?.pillar).toBe('crawlability')
  })

  it('caps the score at 100 even when every pillar is maxed', () => {
    const r = computeCitationWorthinessScore({
      ...baseSignals,
      schemaTypeCount: 10,
      aiCitationCount: 100,
      aiEnginesCiting: 5,
      wordCount: 5000,
      inboundInternalLinks: 30,
    })
    expect(r.score).toBeLessThanOrEqual(100)
  })

  it('decays freshness in a stair pattern (≤30/≤90/≤180/≤365/>365)', () => {
    const at30 = computeCitationWorthinessScore({ ...baseSignals, daysSinceUpdate: 30 }).components
      .freshness
    const at90 = computeCitationWorthinessScore({ ...baseSignals, daysSinceUpdate: 90 }).components
      .freshness
    const at180 = computeCitationWorthinessScore({ ...baseSignals, daysSinceUpdate: 180 })
      .components.freshness
    const at365 = computeCitationWorthinessScore({ ...baseSignals, daysSinceUpdate: 365 })
      .components.freshness
    const past = computeCitationWorthinessScore({ ...baseSignals, daysSinceUpdate: 400 }).components
      .freshness
    expect(at30).toBe(15)
    expect(at90).toBe(12)
    expect(at180).toBe(8)
    expect(at365).toBe(4)
    expect(past).toBe(0)
  })

  it('penalises a hallucination flag in the brand pillar', () => {
    const clean = computeCitationWorthinessScore(baseSignals).components.brand
    const flagged = computeCitationWorthinessScore({
      ...baseSignals,
      hallucinationFlagged: true,
    }).components.brand
    expect(flagged).toBeLessThan(clean)
    expect(flagged).toBe(5) // 10 (mention) - 5 (hallucination) = 5
  })

  it('returns 0 brand pts when neither mention nor flag is present', () => {
    const r = computeCitationWorthinessScore({
      ...baseSignals,
      brandMentioned: false,
      hallucinationFlagged: false,
    })
    expect(r.components.brand).toBe(0)
  })

  it('emits ≤3 recommendations sorted by impact descending', () => {
    const r = computeCitationWorthinessScore({
      schemaValid: false,
      schemaTypeCount: 0,
      aiCrawlersAllowed: false,
      daysSinceUpdate: 500,
      aiCitationCount: 0,
      aiEnginesCiting: 0,
      brandMentioned: false,
      hallucinationFlagged: true,
      wordCount: 200,
      inboundInternalLinks: 0,
    })
    expect(r.recommendations.length).toBeLessThanOrEqual(3)
    for (let i = 1; i < r.recommendations.length; i++) {
      expect(r.recommendations[i - 1]!.impact).toBeGreaterThanOrEqual(r.recommendations[i]!.impact)
    }
  })

  it('puts the page in the "poor" band when nothing is configured', () => {
    const r = computeCitationWorthinessScore({
      schemaValid: false,
      schemaTypeCount: 0,
      aiCrawlersAllowed: false,
      daysSinceUpdate: 999,
      aiCitationCount: 0,
      aiEnginesCiting: 0,
      brandMentioned: false,
      hallucinationFlagged: false,
      wordCount: 100,
      inboundInternalLinks: 0,
    })
    expect(r.band).toBe('poor')
    expect(r.score).toBeLessThan(25)
  })

  it('breakdown sums match the total score', () => {
    const r = computeCitationWorthinessScore(baseSignals)
    const sum =
      r.components.schema +
      r.components.crawlability +
      r.components.freshness +
      r.components.citations +
      r.components.brand +
      r.components.quality
    expect(sum).toBe(r.score)
  })
})
