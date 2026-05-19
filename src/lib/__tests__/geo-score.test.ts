import { describe, it, expect } from 'vitest'
import { calculateGeoScore, gradeFor, GEO_WEIGHTS, type GeoScoreInput } from '../services/geo-score'

const zero: GeoScoreInput = {
  citationRate: 0,
  mentionRate: 0,
  recommendationRate: 0,
  sentimentScore: 0,
  positionAvg: 0,
  hallucinationRate: 0,
}

describe('GEO_WEIGHTS', () => {
  it('weights sum to 1.0', () => {
    const sum = Object.values(GEO_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 10)
  })
})

describe('calculateGeoScore', () => {
  it('returns a low-but-nonzero score for all-zero metrics (neutral position + clean trust)', () => {
    const r = calculateGeoScore(zero)
    // position=0 → 50 (neutral), no hallucination → trust contributes; so > 0.
    expect(r.score).toBeGreaterThan(0)
    expect(r.score).toBeLessThan(40)
    expect(r.grade).toBe('F')
  })

  it('returns ~100 and grade A for perfect metrics', () => {
    const r = calculateGeoScore({
      citationRate: 100,
      mentionRate: 100,
      recommendationRate: 100,
      sentimentScore: 1,
      positionAvg: 1,
      hallucinationRate: 0,
    })
    expect(r.score).toBeGreaterThan(95)
    expect(r.score).toBeLessThanOrEqual(100)
    expect(r.grade).toBe('A')
    expect(r.recommendations).toHaveLength(0)
  })

  it('clamps out-of-range inputs instead of overflowing', () => {
    const r = calculateGeoScore({
      citationRate: 1000,
      mentionRate: 1000,
      recommendationRate: 1000,
      sentimentScore: 9,
      positionAvg: 1,
      hallucinationRate: 5,
    })
    expect(r.score).toBeLessThanOrEqual(100)
    expect(r.score).toBeGreaterThanOrEqual(0)
  })

  it('pillar contributions sum to the final score', () => {
    const r = calculateGeoScore({
      citationRate: 40,
      mentionRate: 55,
      recommendationRate: 30,
      sentimentScore: 0.2,
      positionAvg: 3,
      hallucinationRate: 0.1,
    })
    const summed = r.pillars.reduce((a, p) => a + p.contribution, 0)
    expect(summed).toBeCloseTo(r.score, 0)
  })

  it('exposes all five weighted pillars', () => {
    const r = calculateGeoScore(zero)
    expect(r.pillars.map((p) => p.key).sort()).toEqual([
      'authority',
      'citation',
      'position',
      'presence',
      'trust',
    ])
    r.pillars.forEach((p) => {
      expect(p.weight).toBe(GEO_WEIGHTS[p.key])
    })
  })

  it('prioritizes recommendations by weighted shortfall (citation outranks position)', () => {
    const r = calculateGeoScore({
      citationRate: 10, // weak, weight 0.30
      mentionRate: 80,
      recommendationRate: 80,
      sentimentScore: 1,
      positionAvg: 4.5, // weak-ish, weight 0.15
      hallucinationRate: 0,
    })
    expect(r.recommendations.length).toBeGreaterThan(0)
    // The citation pillar's recommendation should come before position's.
    const citationRec = r.recommendations[0]
    expect(citationRec).toMatch(/cite your domain/i)
  })

  it('normalizes negative sentiment and hallucinations into the trust pillar', () => {
    const clean = calculateGeoScore({ ...zero, sentimentScore: 1, hallucinationRate: 0 })
    const toxic = calculateGeoScore({ ...zero, sentimentScore: -1, hallucinationRate: 1 })
    const trustClean = clean.pillars.find((p) => p.key === 'trust')!.score
    const trustToxic = toxic.pillars.find((p) => p.key === 'trust')!.score
    expect(trustClean).toBeGreaterThan(trustToxic)
    expect(trustToxic).toBe(0)
    expect(trustClean).toBe(100)
  })
})

describe('gradeFor', () => {
  it('maps score bands to letter grades', () => {
    expect(gradeFor(90)).toBe('A')
    expect(gradeFor(85)).toBe('A')
    expect(gradeFor(72)).toBe('B')
    expect(gradeFor(60)).toBe('C')
    expect(gradeFor(45)).toBe('D')
    expect(gradeFor(10)).toBe('F')
  })
})
