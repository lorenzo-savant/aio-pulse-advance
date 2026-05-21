import { describe, it, expect } from 'vitest'
import { lexicalSentiment, sentimentAgreement } from '../services/sentiment-lexicon'

describe('lexicalSentiment', () => {
  it('returns neutral with no hits for text without valence terms', () => {
    const r = lexicalSentiment('The company was founded in 2019 in Stockholm.')
    expect(r).toEqual({ score: 0, label: 'neutral', hits: 0 })
  })

  it('scores clear English positives', () => {
    const r = lexicalSentiment('This is an excellent and reliable service, highly recommended.')
    expect(r.label).toBe('positive')
    expect(r.score).toBeGreaterThan(0.15)
    expect(r.hits).toBeGreaterThanOrEqual(2)
  })

  it('scores clear English negatives', () => {
    const r = lexicalSentiment('A terrible, unreliable product — it felt like a scam.')
    expect(r.label).toBe('negative')
    expect(r.score).toBeLessThan(-0.15)
  })

  it('handles negation (flips polarity)', () => {
    const pos = lexicalSentiment('the support is good')
    const neg = lexicalSentiment('the support is not good')
    expect(pos.label).toBe('positive')
    expect(neg.score).toBeLessThan(pos.score)
  })

  it('reads Swedish sentiment', () => {
    expect(lexicalSentiment('Detta är en utmärkt och pålitlig tjänst.').label).toBe('positive')
    expect(lexicalSentiment('En hemsk och opålitlig bluff.').label).toBe('negative')
  })

  it('reads Italian sentiment', () => {
    expect(lexicalSentiment('Un servizio eccellente e affidabile.').label).toBe('positive')
    expect(lexicalSentiment('Un prodotto pessimo e inaffidabile.').label).toBe('negative')
  })

  it('intensifiers increase magnitude', () => {
    const plain = lexicalSentiment('good')
    const amped = lexicalSentiment('extremely good')
    expect(Math.abs(amped.score)).toBeGreaterThanOrEqual(Math.abs(plain.score))
  })
})

describe('sentimentAgreement', () => {
  it('no conflict when there is no lexical signal', () => {
    expect(sentimentAgreement('positive', { score: 0, label: 'neutral', hits: 0 })).toEqual({
      conflict: 'none',
    })
  })

  it('no conflict when labels match', () => {
    expect(sentimentAgreement('negative', { score: -0.6, label: 'negative', hits: 3 })).toEqual({
      conflict: 'none',
    })
  })

  it('strong conflict on polar opposites with enough signal', () => {
    expect(sentimentAgreement('positive', { score: -0.6, label: 'negative', hits: 3 })).toEqual({
      conflict: 'strong',
    })
  })

  it('soft conflict for a single-hit disagreement', () => {
    expect(sentimentAgreement('positive', { score: -0.5, label: 'negative', hits: 1 })).toEqual({
      conflict: 'soft',
    })
  })

  it('soft conflict against neutral lexical reading', () => {
    expect(sentimentAgreement('positive', { score: 0.1, label: 'neutral', hits: 2 })).toEqual({
      conflict: 'soft',
    })
  })
})
