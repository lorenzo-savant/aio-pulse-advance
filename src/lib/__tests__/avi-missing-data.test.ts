import { describe, it, expect } from 'vitest'
import { calculateAVI, calculateAVIFromResults } from '../services/monitoring'

/**
 * Missing data must not become a measurement.
 *
 * Two defects, both of which printed a number on a client's PDF cover that
 * nothing had measured:
 *
 * 1. A brand no engine had ever mentioned scored **25.0 / 100**. Three absent
 *    signals were each replaced by a midpoint — sentiment 0 → 50, positionAvg 0
 *    → 50, hallucinationIndex 0 → anti-hallucination 100 — and the substitutions
 *    add up to exactly 25 points of fabrication. The report did not say "no
 *    data"; it said 25.0, which reads as a quarter score.
 *
 * 2. The position component inverted what it measures. `mention_position` is a
 *    SENTENCE INDEX capped at 20 (`brand-mention.ts` → `sentenceIndexOf`), but
 *    the formula treated it as a 1-5 list rank, so anything from sentence 5
 *    onward scored zero — while a brand **never mentioned at all** took the
 *    `positionAvg <= 0` branch and scored 50. Being mentioned late was worth
 *    less than not being mentioned.
 *
 * The position tests below hold every other component constant and vary only
 * `positionAvg`, because an earlier draft of this file was fooled: the defect
 * is real but small enough that the other five components hid it in the total.
 */

const result = (over: Partial<Parameters<typeof calculateAVIFromResults>[0][number]> = {}) => ({
  brand_mentioned: false,
  visibility_score: 0,
  sentiment_score: null,
  cited_urls: [] as string[],
  has_hallucination: false,
  mention_position: null,
  ...over,
})

/** Everything except position held flat, so a delta is a position delta. */
const withPosition = (positionAvg: number) =>
  calculateAVI({
    citationRate: 0,
    mentionFrequency: 0,
    sentimentScore: 0,
    recommendationRate: 0,
    positionAvg,
    hallucinationIndex: 0,
  })

describe('AVI — absent signals are not measurements', () => {
  it('scores zero for a brand no engine mentioned', () => {
    const { avi } = calculateAVIFromResults([result(), result(), result(), result()])

    expect(avi).toBe(0)
  })

  it('rates a late mention above no mention at all', () => {
    // The inversion, isolated. 0 is the "never positioned" sentinel the cron
    // writes; 8 is a real mention in the eighth sentence.
    expect(withPosition(8)).toBeGreaterThan(withPosition(0))
  })

  it('does not treat sentence 5 as worthless', () => {
    // Under the 1-5 rank reading, positionAvg 5 scored exactly 0 — a cliff at
    // the fifth sentence of a prose answer, which is still early.
    expect(withPosition(5)).toBeGreaterThan(withPosition(1) * 0.5)
  })

  it('keeps earlier better than later across the real scale', () => {
    expect(withPosition(1)).toBeGreaterThan(withPosition(5))
    expect(withPosition(5)).toBeGreaterThan(withPosition(15))
  })

  it('lets a missing position carry no information either way', () => {
    // Absence must not be a verdict. It should land between the best and worst
    // real readings — not at a fixed midpoint, and not better than the best.
    const best = calculateAVIFromResults([
      result({ brand_mentioned: true, mention_position: 1, sentiment_score: 0.8 }),
    ]).avi
    const worst = calculateAVIFromResults([
      result({ brand_mentioned: true, mention_position: 20, sentiment_score: 0.8 }),
    ]).avi
    const absent = calculateAVIFromResults([
      result({ brand_mentioned: true, mention_position: null, sentiment_score: 0.8 }),
    ]).avi

    expect(absent).toBeLessThan(best)
    expect(absent).toBeGreaterThan(worst)
  })
})
