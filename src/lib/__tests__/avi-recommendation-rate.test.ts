import { describe, it, expect } from 'vitest'
import { calculateAVIFromResults } from '../services/monitoring'

/**
 * `recommendationRate` must measure recommendation.
 *
 * It was computed as `(mentioned.length / total) * 100` — byte-identical to
 * `mentionFrequency` on the line above it. So the AVI declared six components
 * but carried five distinct signals, and mention frequency drove 40% of the
 * score under two names. A report that says "Recommendation Rate: 80%" was
 * restating the mention rate, and the advisor rule `recommendationRate < 30`
 * could never fire independently of the mention rate.
 *
 * A recommendation is a mention the answer speaks well of. Mention stays
 * deterministic (regex, two-pass reconciliation); the sentiment half comes from
 * the analysis model, which is the same source the sentiment component already
 * trusts — so this adds no new kind of dependency, only a new use of one.
 *
 * The threshold is deliberately above zero: "not negative" is not a
 * recommendation, and a neutral listing among ten competitors should not score
 * as one.
 */

const result = (over: Partial<Parameters<typeof calculateAVIFromResults>[0][number]> = {}) => ({
  brand_mentioned: true,
  visibility_score: 50,
  sentiment_score: 0,
  cited_urls: [] as string[],
  has_hallucination: false,
  mention_position: null,
  ...over,
})

describe('AVI — recommendationRate measures recommendation, not mention', () => {
  it('is zero when every mention is negative', () => {
    const { components } = calculateAVIFromResults([
      result({ sentiment_score: -0.8 }),
      result({ sentiment_score: -0.5 }),
    ])

    // The brand IS mentioned every time...
    expect(components.mentionFrequency).toBe(100)
    // ...and recommended none of them. These two must be able to disagree.
    expect(components.recommendationRate).toBe(0)
  })

  it('counts a mention the answer speaks well of', () => {
    const { components } = calculateAVIFromResults([
      result({ sentiment_score: 0.9 }),
      result({ sentiment_score: 0.6 }),
    ])

    expect(components.recommendationRate).toBe(100)
  })

  it('does not count neutral mentions', () => {
    // Being listed without praise is visibility, not endorsement.
    const { components } = calculateAVIFromResults([result({ sentiment_score: 0 })])

    expect(components.mentionFrequency).toBe(100)
    expect(components.recommendationRate).toBe(0)
  })

  it('counts only the positive share', () => {
    const { components } = calculateAVIFromResults([
      result({ sentiment_score: 0.9 }),
      result({ sentiment_score: -0.9 }),
      result({ sentiment_score: 0.8 }),
      result({ sentiment_score: 0 }),
    ])

    expect(components.mentionFrequency).toBe(100)
    expect(components.recommendationRate).toBe(50)
  })

  it('never counts an unmentioned response, however positive', () => {
    // Sentiment about something else is not a recommendation of this brand.
    const { components } = calculateAVIFromResults([
      result({ brand_mentioned: false, sentiment_score: 0.95 }),
      result({ brand_mentioned: true, sentiment_score: 0.95 }),
    ])

    expect(components.mentionFrequency).toBe(50)
    expect(components.recommendationRate).toBe(50)
  })

  it('treats a missing sentiment as not a recommendation', () => {
    const { components } = calculateAVIFromResults([result({ sentiment_score: null })])

    expect(components.recommendationRate).toBe(0)
  })
})
