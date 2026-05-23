import { describe, it, expect } from 'vitest'
import {
  estimateCtrAtPosition,
  estimateUpliftClicks,
  strikingDistanceBand,
  STRIKING_DISTANCE_TARGET_POSITION,
} from '@/lib/utils/striking-distance'

describe('estimateCtrAtPosition', () => {
  it('returns higher CTR for higher (better) positions', () => {
    expect(estimateCtrAtPosition(1)).toBeGreaterThan(estimateCtrAtPosition(3))
    expect(estimateCtrAtPosition(3)).toBeGreaterThan(estimateCtrAtPosition(10))
    expect(estimateCtrAtPosition(10)).toBeGreaterThan(estimateCtrAtPosition(20))
    expect(estimateCtrAtPosition(20)).toBeGreaterThan(estimateCtrAtPosition(40))
  })

  it('returns 0 for invalid positions', () => {
    expect(estimateCtrAtPosition(0)).toBe(0)
    expect(estimateCtrAtPosition(-1)).toBe(0)
    expect(estimateCtrAtPosition(NaN)).toBe(0)
  })

  it('top of page 1 CTR is realistic (≈ 30%)', () => {
    expect(estimateCtrAtPosition(1)).toBeCloseTo(0.3, 2)
  })
})

describe('estimateUpliftClicks', () => {
  it('estimates positive uplift for a typical striking-distance query', () => {
    // pos 14 with 1% CTR + 5000 impressions/month should gain ~9% × 5000 = ~450 clicks
    const uplift = estimateUpliftClicks(5000, 0.01)
    expect(uplift).toBeGreaterThan(400)
    expect(uplift).toBeLessThan(500)
  })

  it('returns 0 when current CTR already meets or exceeds the target', () => {
    // pos 2 already has higher CTR than target (pos 3), so no uplift to claim
    expect(estimateUpliftClicks(1000, 0.2)).toBe(0)
  })

  it('returns 0 for non-positive impressions', () => {
    expect(estimateUpliftClicks(0, 0.01)).toBe(0)
    expect(estimateUpliftClicks(-100, 0.01)).toBe(0)
    expect(estimateUpliftClicks(NaN, 0.01)).toBe(0)
  })

  it('uplift scales linearly with impressions', () => {
    const small = estimateUpliftClicks(1000, 0.01)
    const big = estimateUpliftClicks(10000, 0.01)
    expect(big).toBeGreaterThanOrEqual(small * 9) // within rounding
  })

  it('uses the documented default target position', () => {
    expect(STRIKING_DISTANCE_TARGET_POSITION).toBe(3)
  })
})

describe('strikingDistanceBand', () => {
  it('puts positions 11–13 in "edge" (one nudge from page 1)', () => {
    expect(strikingDistanceBand(11)).toBe('edge')
    expect(strikingDistanceBand(13)).toBe('edge')
  })

  it('puts positions 14–20 in "mid"', () => {
    expect(strikingDistanceBand(14)).toBe('mid')
    expect(strikingDistanceBand(20)).toBe('mid')
  })

  it('puts positions 21+ in "far"', () => {
    expect(strikingDistanceBand(21)).toBe('far')
    expect(strikingDistanceBand(30)).toBe('far')
  })
})
