import { describe, it, expect } from 'vitest'
import { calculateAVIFromResults, analysisOutputSchema } from '../services/monitoring'

/**
 * "0 hallucinations" must mean a check ran and found none.
 *
 * Two things made it mean something else:
 *
 * 1. The persisted `has_hallucination` is not the output of the fact-checker.
 *    `detectHallucinations` — the function whose prompt opens "You are a
 *    fact-checking AI" — has exactly one caller, `/api/sentiment`. The
 *    monitoring pipeline never invokes it. What gets stored is the ANALYSIS
 *    model's self-report, produced by the same prompt that also asks for
 *    sentiment and competitors.
 *
 * 2. That self-report defaulted to `false` on omission. A model returning valid
 *    JSON without the key — the single most common LLM omission — produced a row
 *    recorded as clean. So a degraded response and a verified-clean one were
 *    indistinguishable, and the anti-hallucination component handed out its full
 *    10 AVI points either way. Silent inflation, by default, exactly when the
 *    model was misbehaving.
 *
 * The column is `boolean DEFAULT false` and nullable, so "not assessed" is
 * storable as NULL with no migration. Absent means absent: the component drops
 * out of the score and its weight is shared by what was measured, the same rule
 * the position component already follows.
 *
 * This does not make the number trustworthy — it is still a model grading
 * itself. It makes it honest about when it is missing.
 */

const result = (over: Partial<Parameters<typeof calculateAVIFromResults>[0][number]> = {}) => ({
  brand_mentioned: true,
  visibility_score: 60,
  sentiment_score: 0.6,
  cited_urls: [] as string[],
  has_hallucination: false as boolean | null,
  mention_position: 3,
  ...over,
})

describe('hallucination — absent is not clean', () => {
  it('does not turn a missing key into a clean verdict', () => {
    const parsed = analysisOutputSchema.parse({
      brand_mentioned: true,
      visibility_score: 50,
      // has_hallucination deliberately absent
    })

    expect(parsed.has_hallucination).not.toBe(false)
    expect(parsed.has_hallucination == null).toBe(true)
  })

  it('still records an explicit clean verdict as clean', () => {
    const parsed = analysisOutputSchema.parse({
      brand_mentioned: true,
      visibility_score: 50,
      has_hallucination: false,
    })

    expect(parsed.has_hallucination).toBe(false)
  })

  it('ranks an unassessed run between a clean one and a hallucinated one', () => {
    // Absence carries no information: it must not earn the full credit a
    // verified-clean run earns, nor the penalty a hallucinated one takes.
    const clean = calculateAVIFromResults([result({ has_hallucination: false })]).avi
    const unassessed = calculateAVIFromResults([result({ has_hallucination: null })]).avi
    const hallucinated = calculateAVIFromResults([result({ has_hallucination: true })]).avi

    expect(unassessed).toBeLessThan(clean)
    expect(unassessed).toBeGreaterThan(hallucinated)
  })

  it('measures the index over assessed results only', () => {
    // One hallucination out of two ASSESSED results is 50%, not 33% — an
    // unassessed row must not dilute the denominator into looking cleaner.
    const { components } = calculateAVIFromResults([
      result({ has_hallucination: true }),
      result({ has_hallucination: false }),
      result({ has_hallucination: null }),
    ])

    expect(components.hallucinationIndex).toBe(50)
  })
})
