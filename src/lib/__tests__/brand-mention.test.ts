import { describe, it, expect } from 'vitest'
import { detectBrandMention, extractUrlsFromText } from '../services/brand-mention'

describe('detectBrandMention', () => {
  it('detects a direct whole-word name match and counts occurrences', () => {
    const r = detectBrandMention('Acasting is great. I recommend Acasting again.', {
      name: 'Acasting',
    })
    expect(r.brandMentioned).toBe(true)
    expect(r.mentionCount).toBe(2)
    expect(r.mentionType).toBe('direct')
    expect(r.mentionPosition).toBe(1)
  })

  it('does NOT match a look-alike substring (Acast ≠ Acasting)', () => {
    const r = detectBrandMention('Acast is a podcast platform.', { name: 'Acasting' })
    expect(r.brandMentioned).toBe(false)
    expect(r.mentionType).toBe('none')
  })

  it('matches via alias and reports indirect when the primary name is absent', () => {
    const r = detectBrandMention('We used Savant Media for the campaign.', {
      name: 'Savant Media AB',
      aliases: ['Savant Media'],
    })
    expect(r.brandMentioned).toBe(true)
    expect(r.mentionType).toBe('indirect')
  })

  it('matches the domain (guarded against superstrings)', () => {
    const yes = detectBrandMention('See acasting.se for details.', {
      name: 'Acasting',
      domain: 'https://www.acasting.se/',
    })
    expect(yes.brandMentioned).toBe(true)

    const no = detectBrandMention('Visit notacasting.se instead.', {
      name: 'Acasting',
      domain: 'acasting.se',
    })
    expect(no.brandMentioned).toBe(false)
  })

  it('handles Swedish characters in whole-word boundaries', () => {
    const r = detectBrandMention('Mäklarna är bäst enligt Hjärta.', { name: 'Hjärta' })
    expect(r.brandMentioned).toBe(true)
    expect(r.mentionType).toBe('direct')
  })

  it('reports a later sentence index for a mention further down', () => {
    const r = detectBrandMention('First sentence here. Second one. Then Acasting appears.', {
      name: 'Acasting',
    })
    expect(r.mentionPosition).toBe(3)
  })

  it('returns none for empty input', () => {
    expect(detectBrandMention('', { name: 'Acme' }).mentionType).toBe('none')
    expect(detectBrandMention('text', { name: '' }).brandMentioned).toBe(false)
  })
})

describe('extractUrlsFromText', () => {
  it('extracts URLs and trims trailing punctuation', () => {
    expect(
      extractUrlsFromText('See https://example.com/a, and (https://reco.se/x). Done.'),
    ).toEqual(['https://example.com/a', 'https://reco.se/x'])
  })

  it('returns empty when there are no URLs', () => {
    expect(extractUrlsFromText('No links here at all.')).toEqual([])
  })
})
