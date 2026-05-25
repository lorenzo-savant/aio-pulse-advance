import { describe, it, expect } from 'vitest'
import { extractSentimentDrivers, type SentimentDriverRow } from '../services/sentiment-drivers'

const row = (over: Partial<SentimentDriverRow>): SentimentDriverRow => ({
  brand_mentioned: true,
  response_text: '',
  sentiment_score: null,
  id: null,
  created_at: '2026-05-20T10:00:00Z',
  ...over,
})

describe('extractSentimentDrivers', () => {
  it('returns empty buckets for no rows', () => {
    const out = extractSentimentDrivers([], 'Acme')
    expect(out.positive).toEqual([])
    expect(out.negative).toEqual([])
    expect(out.neutral).toEqual([])
    expect(out.totalResponses).toBe(0)
    expect(out.responsesWithDriver).toBe(0)
  })

  it('skips rows that do not mention the brand', () => {
    const rows: SentimentDriverRow[] = [
      row({ brand_mentioned: false, response_text: 'Acme has excellent pricing and easy setup' }),
    ]
    const out = extractSentimentDrivers(rows, 'Acme', { minMentions: 1 })
    expect(out.responsesWithDriver).toBe(0)
    expect(out.positive).toEqual([])
  })

  it('classifies a driver as positive when the window is positively worded', () => {
    const rows: SentimentDriverRow[] = [
      row({ response_text: 'Acme offers excellent pricing and great value', id: 'r1' }),
      row({ response_text: 'I love Acme — affordable pricing all around', id: 'r2' }),
    ]
    const out = extractSentimentDrivers(rows, 'Acme', { minMentions: 1 })
    const pricing = out.positive.find((d) => d.id === 'pricing')
    expect(pricing).toBeDefined()
    expect(pricing!.pos).toBeGreaterThanOrEqual(1)
    expect(pricing!.avgScore).toBeGreaterThan(0.15)
    expect(pricing!.sampleResponseIds).toContain('r1')
  })

  it('classifies a driver as negative when the window is negatively worded', () => {
    const rows: SentimentDriverRow[] = [
      row({ response_text: 'Acme has terrible support and unresponsive customer service' }),
      row({ response_text: 'Acme: awful support, poor documentation, scam' }),
    ]
    const out = extractSentimentDrivers(rows, 'Acme', { minMentions: 1 })
    const support = out.negative.find((d) => d.id === 'support')
    expect(support).toBeDefined()
    expect(support!.neg).toBeGreaterThanOrEqual(1)
    expect(support!.avgScore).toBeLessThan(-0.15)
  })

  it('only scans the window around the brand mention, not the whole response', () => {
    // Praise is far from the brand; "terrible support" is right next to it.
    // The window should pick up support+negative and ignore the distant praise.
    // Use lorem-ipsum filler — neutral, no driver keywords, no valence words.
    const filler = Array(40).fill('lorem ipsum dolor sit amet').join(' ')
    const rows: SentimentDriverRow[] = [
      row({ response_text: `excellent reliable amazing ${filler} Acme has terrible support` }),
    ]
    const out = extractSentimentDrivers(rows, 'Acme', { minMentions: 1, windowTokens: 5 })
    const support = out.negative.find((d) => d.id === 'support')
    expect(support).toBeDefined()
    expect(support!.neg).toBe(1)
    // The distant "reliable" must NOT have been picked up as a reliability driver.
    expect(out.positive.find((d) => d.id === 'reliability')).toBeUndefined()
  })

  it('honours minMentions filter', () => {
    const rows: SentimentDriverRow[] = [row({ response_text: 'Acme has great pricing' })]
    const out = extractSentimentDrivers(rows, 'Acme', { minMentions: 2 })
    expect(out.positive).toEqual([])
    expect(out.negative).toEqual([])
  })

  it('matches Swedish brand wording (acasting.se preset)', () => {
    const rows: SentimentDriverRow[] = [
      row({ response_text: 'acasting.se har utmärkt kvalitet och pålitlig support' }),
      row({ response_text: 'acasting.se är pålitlig och professionell' }),
    ]
    const out = extractSentimentDrivers(rows, 'acasting.se', { minMentions: 1 })
    const quality = out.positive.find((d) => d.id === 'quality')
    expect(quality).toBeDefined()
    expect(quality!.avgScore).toBeGreaterThan(0)
  })

  it('uses LLM sentiment_score when the lexicon has no signal', () => {
    // No valence words anywhere — only the LLM score should drive the label.
    const rows: SentimentDriverRow[] = [
      row({ response_text: 'Acme operates with pricing in their domain', sentiment_score: 0.8 }),
      row({ response_text: 'Acme pricing details for customers', sentiment_score: 0.7 }),
    ]
    const out = extractSentimentDrivers(rows, 'Acme', { minMentions: 1 })
    const pricing = out.positive.find((d) => d.id === 'pricing')
    expect(pricing).toBeDefined()
    expect(pricing!.pos).toBe(2)
  })

  it('merges overlapping mention windows so a single cluster counts once', () => {
    // Two Acme mentions within a 5-token gap — at windowTokens=10 their
    // windows fully overlap and should yield ONE driver hit, not two.
    const rows: SentimentDriverRow[] = [
      row({ response_text: 'Acme is great and Acme has excellent pricing today' }),
    ]
    const out = extractSentimentDrivers(rows, 'Acme', { minMentions: 1, windowTokens: 10 })
    const pricing = out.positive.find((d) => d.id === 'pricing')
    expect(pricing).toBeDefined()
    expect(pricing!.mentions).toBe(1)
  })

  it('matches brand by alias when provided', () => {
    const rows: SentimentDriverRow[] = [
      row({ response_text: 'Savant Media offers excellent quality services' }),
      row({ response_text: 'Savant Media delivers reliable, professional work' }),
    ]
    const out = extractSentimentDrivers(rows, 'savantmedia.se', {
      minMentions: 1,
      aliases: ['Savant Media'],
    })
    const quality = out.positive.find((d) => d.id === 'quality')
    expect(quality).toBeDefined()
    expect(quality!.mentions).toBeGreaterThanOrEqual(1)
  })

  it('caps sampleResponseIds at 3', () => {
    const rows: SentimentDriverRow[] = Array.from({ length: 5 }, (_, i) =>
      row({ id: `r${i}`, response_text: 'Acme has excellent pricing' }),
    )
    const out = extractSentimentDrivers(rows, 'Acme', { minMentions: 1 })
    const pricing = out.positive.find((d) => d.id === 'pricing')!
    expect(pricing.sampleResponseIds).toHaveLength(3)
  })

  it('counts responsesWithDriver only once per row even with multiple drivers', () => {
    const rows: SentimentDriverRow[] = [
      row({ response_text: 'Acme has great pricing AND excellent support — easy to use too' }),
    ]
    const out = extractSentimentDrivers(rows, 'Acme', { minMentions: 1 })
    expect(out.totalResponses).toBe(1)
    expect(out.responsesWithDriver).toBe(1)
  })
})
