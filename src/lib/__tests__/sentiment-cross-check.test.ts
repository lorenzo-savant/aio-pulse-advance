import { describe, it, expect } from 'vitest'
import { calculateAVIFromResults, resolveSentiment } from '../services/monitoring'

/**
 * The sentiment number carries 35% of the AVI and had no second opinion.
 *
 * After the recommendation fix, sentiment enters the score twice: directly at
 * 15%, and through `recommendationRate` at 20%, which classifies a mention as a
 * recommendation on `sentiment_score >= 0.25`. So a third of a client-facing
 * score rests on one model's judgement of one response.
 *
 * A deterministic cross-check already existed — `sentiment-lexicon.ts`, 273
 * lines, trilingual, with its own test file — and was wired into
 * `analyzeSentiment`, which only `/api/sentiment` calls. The pipeline that
 * writes the database never used it.
 *
 * `sentimentAgreement` reports `strong` only when the lexicon finds the OPPOSITE
 * polarity with at least two hits. That is a conservative signal and a good
 * enough reason to refuse a number: not "the model is wrong", but "these two
 * disagree flatly, so nothing here is measured well enough to score".
 */

describe('sentiment — deterministic cross-check', () => {
  it('keeps the model score when the lexicon agrees', () => {
    const r = resolveSentiment('positive', 0.8, 'Relovie is excellent, a great choice.')

    expect(r.score).toBe(0.8)
    expect(r.conflict).toBe('none')
  })

  it('keeps the score when the lexicon simply has nothing to say', () => {
    // No lexicon hits is not disagreement.
    const r = resolveSentiment('positive', 0.6, 'Relovie operates in Sweden.')

    expect(r.score).toBe(0.6)
  })

  it('refuses the score when the lexicon flatly contradicts it', () => {
    // Model says positive; the text is plainly negative.
    const r = resolveSentiment(
      'positive',
      0.9,
      'Relovie is terrible and awful, a scam to avoid at all costs.',
    )

    expect(r.conflict).toBe('strong')
    expect(r.score).toBeNull()
  })

  it('drops the sentiment component from the score rather than guessing', () => {
    // Every mention disputed: sentiment cannot contribute, and must not be
    // replaced by a neutral midpoint.
    const disputed = calculateAVIFromResults([
      {
        brand_mentioned: true,
        visibility_score: 60,
        sentiment_score: null,
        cited_urls: [],
        has_hallucination: false,
        mention_position: 2,
      },
    ])

    expect(disputed.components.sentimentScore).toBeNull()
    expect(disputed.avi).toBeGreaterThan(0)
  })
})
