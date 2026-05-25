import { describe, it, expect } from 'vitest'
import { findMentionInjectionOpportunities, type InjectionInput } from '../utils/mention-injection'

const brand = { name: 'Pulse', domain: 'pulse.example' }

const baseInput = (
  pages: InjectionInput['pages'],
  topics = ['AI visibility', 'share of voice', 'LLM citations'],
): InjectionInput => ({ brand, pages, topics })

describe('findMentionInjectionOpportunities', () => {
  it('returns no opportunities when no pages match any topic', () => {
    const r = findMentionInjectionOpportunities(
      baseInput([
        { url: 'https://x.test/a', text: 'A short post about cats and other unrelated subjects.' },
      ]),
    )
    expect(r.opportunities).toEqual([])
    expect(r.notRelevant).toBe(1)
    expect(r.alreadyCovered).toBe(0)
  })

  it('skips pages that already mention the brand', () => {
    const r = findMentionInjectionOpportunities(
      baseInput([
        {
          url: 'https://x.test/a',
          text: 'AI visibility is critical. Pulse tracks it daily across every engine.',
        },
      ]),
    )
    expect(r.alreadyCovered).toBe(1)
    expect(r.opportunities).toEqual([])
  })

  it('flags a relevant page that never mentions the brand', () => {
    const r = findMentionInjectionOpportunities(
      baseInput([
        {
          url: 'https://x.test/post',
          title: 'Why AI visibility matters',
          text: 'AI visibility is the new ranking metric. Share of voice quantifies it across engines.',
        },
      ]),
    )
    expect(r.opportunities).toHaveLength(1)
    const op = r.opportunities[0]!
    expect(op.url).toBe('https://x.test/post')
    expect(op.title).toBe('Why AI visibility matters')
    expect(op.matchedTopics).toEqual(['AI visibility', 'share of voice'])
    expect(op.topicHitCount).toBe(2)
    expect(op.suggestedAnchor).toMatch(/AI visibility/i)
    expect(op.priority).toBeGreaterThan(0)
  })

  it('ranks pages with more distinct matching topics higher', () => {
    const r = findMentionInjectionOpportunities(
      baseInput([
        {
          url: 'https://x.test/single',
          text: 'A long post mentioning AI visibility exactly once near the very end of this lengthy article. Filler. Filler. Filler. Filler. Filler. Filler. Filler. Filler. Filler. Filler. Filler. Filler. Filler. Filler. Filler. Filler. Filler. Filler. Filler. Filler. AI visibility.',
        },
        {
          url: 'https://x.test/triple',
          text: 'AI visibility, share of voice, and LLM citations are the new SEO triangle. All three matter.',
        },
      ]),
    )
    expect(r.opportunities[0]!.url).toBe('https://x.test/triple')
    expect(r.opportunities[1]!.url).toBe('https://x.test/single')
    expect(r.opportunities[0]!.priority).toBeGreaterThan(r.opportunities[1]!.priority)
  })

  it('strips HTML to derive page text when no plain text is supplied', () => {
    const r = findMentionInjectionOpportunities(
      baseInput([
        {
          url: 'https://x.test/html',
          html: '<article><h1>Guide</h1><p>AI visibility is what every modern brand should track.</p></article>',
        },
      ]),
    )
    expect(r.opportunities).toHaveLength(1)
    expect(r.opportunities[0]!.matchedTopics).toEqual(['AI visibility'])
  })

  it('matches topics case-insensitively as whole phrases', () => {
    const r = findMentionInjectionOpportunities(
      baseInput([
        {
          url: 'https://x.test/case',
          text: 'ai VISIBILITY means appearing in AI answers. Visibility alone is not the same.',
        },
      ]),
    )
    const op = r.opportunities[0]!
    // "ai VISIBILITY" matches once; bare "Visibility" should NOT — whole-phrase.
    expect(op.topicHitCount).toBe(1)
    expect(op.matchedTopics).toEqual(['AI visibility'])
  })

  it('suggests an anchor sentence that contains the earliest topic hit', () => {
    const r = findMentionInjectionOpportunities(
      baseInput([
        {
          url: 'https://x.test/anchor',
          text: 'Some unrelated intro. Then a section on share of voice that defines it clearly. Followed by AI visibility coverage.',
        },
      ]),
    )
    const op = r.opportunities[0]!
    expect(op.suggestedAnchor).toMatch(/share of voice/i)
  })

  it('respects the limit by sorting on priority desc', () => {
    const pages = Array.from({ length: 8 }, (_, i) => ({
      url: `https://x.test/${i}`,
      text: `AI visibility ${i}.`,
    }))
    const r = findMentionInjectionOpportunities({ ...baseInput(pages), limit: 3 })
    expect(r.opportunities).toHaveLength(3)
    expect(r.scanned).toBe(8)
  })

  it('counts pages with no extractable text as not-relevant', () => {
    const r = findMentionInjectionOpportunities(
      baseInput([
        { url: 'https://x.test/empty', text: '' },
        { url: 'https://x.test/whitespace', html: '<div>   </div>' },
      ]),
    )
    expect(r.notRelevant).toBe(2)
    expect(r.opportunities).toEqual([])
  })
})
