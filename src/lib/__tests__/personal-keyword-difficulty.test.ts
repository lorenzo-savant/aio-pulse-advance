import { describe, it, expect } from 'vitest'
import {
  computeAuthorityFactor,
  computePersonalKeywordDifficulty,
  estimateKdFromPosition,
  type AuthoritySignals,
} from '@/lib/utils/personal-keyword-difficulty'

const noAuthority: AuthoritySignals = {
  totalClicks: 0,
  avgPosition: null,
  totalAiCitations: 0,
  uniquePages: 0,
}

// Genuinely small brand — under 1k monthly clicks, mid SERP rank, almost
// no AI citations. The calibration intent: this should land mid-band
// (~0.25), well below an established brand.
const midAuthority: AuthoritySignals = {
  totalClicks: 600,
  avgPosition: 18,
  totalAiCitations: 5,
  uniquePages: 12,
}

const strongAuthority: AuthoritySignals = {
  totalClicks: 250_000,
  avgPosition: 4,
  totalAiCitations: 800,
  uniquePages: 500,
}

describe('computeAuthorityFactor', () => {
  it('returns a very low factor for a brand with no signals', () => {
    expect(computeAuthorityFactor(noAuthority)).toBeLessThan(0.05)
  })

  it('returns a mid factor for a small/mid brand', () => {
    const f = computeAuthorityFactor(midAuthority)
    expect(f).toBeGreaterThan(0.15)
    expect(f).toBeLessThan(0.5)
  })

  it('returns the high (capped) factor for a strong brand', () => {
    const f = computeAuthorityFactor(strongAuthority)
    expect(f).toBeGreaterThan(0.45)
    expect(f).toBeLessThanOrEqual(0.7) // hard cap
  })

  it('caps the factor at 0.7 even for an unrealistically large brand', () => {
    const monster: AuthoritySignals = {
      totalClicks: 10_000_000,
      avgPosition: 1,
      totalAiCitations: 100_000,
      uniquePages: 50_000,
    }
    expect(computeAuthorityFactor(monster)).toBeLessThanOrEqual(0.7)
  })

  it('treats avgPosition = null as 0 contribution from the position signal', () => {
    const noPos: AuthoritySignals = { ...midAuthority, avgPosition: null }
    const withPos: AuthoritySignals = midAuthority
    expect(computeAuthorityFactor(noPos)).toBeLessThan(computeAuthorityFactor(withPos))
  })
})

describe('computePersonalKeywordDifficulty', () => {
  it('reduces a high KD substantially for a strong brand', () => {
    const r = computePersonalKeywordDifficulty(60, strongAuthority)
    expect(r.pkd).toBeLessThan(60)
    expect(r.deltaVsKd).toBeLessThan(0)
    // 60 × (1 - ~0.5) = ~30 → within_reach
    expect(r.band).toBe('within_reach')
  })

  it('barely shifts the KD for a brand with no signals', () => {
    const r = computePersonalKeywordDifficulty(60, noAuthority)
    // factor < 0.05 → 60 × 0.95 = 57 → still "stretch" (tough threshold 60).
    expect(r.pkd).toBeGreaterThanOrEqual(57)
    expect(r.band).toBe('stretch')
  })

  it('clamps the input KD to [0, 100]', () => {
    expect(computePersonalKeywordDifficulty(-5, midAuthority).pkd).toBe(0)
    expect(computePersonalKeywordDifficulty(120, midAuthority).pkd).toBeLessThanOrEqual(100)
  })

  it('uses the calibrated 35 / 60 bands for the verdict', () => {
    expect(computePersonalKeywordDifficulty(20, noAuthority).band).toBe('within_reach')
    expect(computePersonalKeywordDifficulty(50, noAuthority).band).toBe('stretch')
    expect(computePersonalKeywordDifficulty(90, noAuthority).band).toBe('tough')
  })

  it('returns a sensible default when KD is NaN', () => {
    const r = computePersonalKeywordDifficulty(Number.NaN, midAuthority)
    // Falls back to KD=50 internally → mid-band.
    expect(r.pkd).toBeGreaterThanOrEqual(0)
    expect(r.pkd).toBeLessThanOrEqual(100)
  })
})

describe('estimateKdFromPosition', () => {
  it('returns a low KD for already-strong positions', () => {
    expect(estimateKdFromPosition(3)).toBe(35)
    expect(estimateKdFromPosition(10)).toBe(45)
  })

  it('returns a mid KD for striking-distance positions', () => {
    expect(estimateKdFromPosition(15)).toBe(55)
    expect(estimateKdFromPosition(20)).toBe(62)
  })

  it('returns a high KD for deep positions', () => {
    expect(estimateKdFromPosition(45)).toBe(78)
    expect(estimateKdFromPosition(99)).toBe(85)
  })

  it('falls back to 50 for non-positive / non-finite inputs', () => {
    expect(estimateKdFromPosition(0)).toBe(50)
    expect(estimateKdFromPosition(Number.NaN)).toBe(50)
    expect(estimateKdFromPosition(-3)).toBe(50)
  })
})
