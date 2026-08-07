import { describe, it, expect } from 'vitest'
import {
  POSITION_SCALE_MAX,
  normalizePositionScore,
  hasMeasuredPosition,
} from '../metrics/position'
import { calculateAVI } from '../services/monitoring'
import { calculateGeoScore } from '../services/geo-score'

/**
 * `mention_position` is the index of the SENTENCE in which a brand first
 * appears, capped at 20 by `brand-mention.ts` → `sentenceIndexOf`. It is not a
 * 1-5 search rank.
 *
 * Commit 1a1e10d established that, moved the AVI to POSITION_SCALE_MAX = 20,
 * and shipped a recalc script for the stored rows. It fixed ONE of the four
 * places the old `((5 - p) / 4) * 100` lived. The others stayed:
 *
 *   · services/geo-score.ts        — the GEO Score position pillar (15%)
 *   · services/monitoring.ts       — competitor weakest-component selection
 *   · components/dashboard/AVIScoreCard.tsx — the Position bar drawn directly
 *     beneath an AVI computed on the corrected scale
 *
 * A comment in geo-score.ts asserted it mirrored calculateAVI. True before
 * 1a1e10d, false after — which is exactly why reading the code did not catch
 * it. This file is the test that would have.
 *
 * It belongs to neither module: it asserts a relationship BETWEEN them, and a
 * single-module test by construction cannot.
 */

/** Isolate the position pillar: every other GEO input absent, so weights
 *  re-normalise onto position alone and the pillar score IS the composite. */
function geoPositionPillar(positionAvg: number): number | null {
  const result = calculateGeoScore({
    citationRate: null,
    mentionRate: null,
    recommendationRate: null,
    sentimentScore: null,
    positionAvg,
    hallucinationRate: null,
  })
  return result.pillars.find((p) => p.key === 'position')?.score ?? null
}

/** Isolate the AVI position component the same way. */
function aviPositionComponent(positionAvg: number): number {
  return calculateAVI({
    citationRate: 0,
    mentionFrequency: 0,
    sentimentScore: null,
    recommendationRate: null,
    positionAvg,
    hallucinationIndex: null,
  })
}

describe('position normalisation is one definition, not three', () => {
  const positions = [1, 2, 3, 4, 5, 8, 12, 17, 20, 25, 60]

  it.each(positions)('GEO pillar and the shared normaliser agree at position %i', (p) => {
    expect(geoPositionPillar(p)).toBeCloseTo(normalizePositionScore(p), 1)
  })

  it('the 1-5 divisor is gone: position 5 is no longer a zero', () => {
    // The old formula sent everything from the fifth sentence on to exactly 0.
    // Measured against 203 stored brand rows, that was 24% of them.
    expect(normalizePositionScore(5)).toBeGreaterThan(70)
    expect(geoPositionPillar(5)).toBeGreaterThan(70)
  })

  it('scores the first sentence at 100 and the scale ceiling at 0', () => {
    expect(normalizePositionScore(1)).toBe(100)
    expect(normalizePositionScore(POSITION_SCALE_MAX)).toBe(0)
  })

  it('clamps beyond the ceiling instead of going negative', () => {
    // Real data contains an average of 62.8. Without the clamp that is -226.
    expect(normalizePositionScore(62.8)).toBe(0)
    expect(normalizePositionScore(218)).toBe(0)
  })

  it('is monotonic: appearing earlier never scores worse', () => {
    for (let i = 1; i < positions.length; i++) {
      const earlier = normalizePositionScore(positions[i - 1]!)
      const later = normalizePositionScore(positions[i]!)
      expect(earlier).toBeGreaterThanOrEqual(later)
    }
  })
})

describe('absence is excluded, never given a value', () => {
  it('rejects the never-positioned sentinel as a measurement', () => {
    expect(hasMeasuredPosition(0)).toBe(false)
    expect(hasMeasuredPosition(-1)).toBe(false)
    expect(hasMeasuredPosition(null)).toBe(false)
    expect(hasMeasuredPosition(undefined)).toBe(false)
    expect(hasMeasuredPosition(1)).toBe(true)
  })

  it('drops the GEO position pillar entirely when nothing was positioned', () => {
    // Not a 0, and not the 50 the old code fabricated: the pillar is absent
    // and the remaining weights re-normalise around it.
    expect(geoPositionPillar(0)).toBeNull()
  })

  it('drops the AVI position component when nothing was positioned', () => {
    // With every other component at zero weight, an included position
    // component would move the score. It must not.
    expect(aviPositionComponent(0)).toBe(aviPositionComponent(-1))
  })
})

describe('AVI and GEO react to position identically', () => {
  it('both improve when the brand is named earlier', () => {
    const geoEarly = geoPositionPillar(2)!
    const geoLate = geoPositionPillar(15)!
    const aviEarly = aviPositionComponent(2)
    const aviLate = aviPositionComponent(15)

    expect(geoEarly).toBeGreaterThan(geoLate)
    expect(aviEarly).toBeGreaterThan(aviLate)
  })

  it('agree on where the signal dies', () => {
    // Under the old divisor these disagreed from position 5 onward: GEO said
    // 0 while AVI said 78.9 for the very same stored value.
    expect(geoPositionPillar(POSITION_SCALE_MAX)).toBe(0)
    expect(normalizePositionScore(POSITION_SCALE_MAX)).toBe(0)
  })
})
