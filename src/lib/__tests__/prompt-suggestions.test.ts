import { describe, it, expect } from 'vitest'
import { relatedQuestionsToPromptSuggestions } from '../services/prompt-suggestions'

describe('relatedQuestionsToPromptSuggestions', () => {
  it('converts related questions into suggestions with provenance', () => {
    const out = relatedQuestionsToPromptSuggestions(
      ['What is the best casting platform in Sweden?', 'How does acasting.se pricing work?'],
      [],
      { source: 'perplexity' },
    )
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({
      text: 'What is the best casting platform in Sweden?',
      source: 'perplexity',
    })
  })

  it('dedupes against existing prompts (case/whitespace/punctuation-insensitive)', () => {
    const out = relatedQuestionsToPromptSuggestions(
      ['Best casting platform in Sweden?', '  best   CASTING platform in sweden  '],
      ['best casting platform in sweden'],
    )
    expect(out).toHaveLength(0) // both collapse to an existing prompt
  })

  it('dedupes near-identical suggestions among themselves', () => {
    const out = relatedQuestionsToPromptSuggestions([
      'How much does it cost?',
      'How much does it cost?',
      'how much does IT cost',
    ])
    expect(out).toHaveLength(1)
  })

  it('filters out trivially short entries', () => {
    const out = relatedQuestionsToPromptSuggestions([
      'ok',
      'why?',
      'Is acasting.se good for actors?',
    ])
    expect(out.map((s) => s.text)).toEqual(['Is acasting.se good for actors?'])
  })

  it('respects the max cap and preserves order', () => {
    const out = relatedQuestionsToPromptSuggestions(
      ['question number one here', 'question number two here', 'question number three here'],
      [],
      { max: 2 },
    )
    expect(out).toHaveLength(2)
    expect(out[0]?.text).toBe('question number one here')
  })

  it('ignores non-string entries defensively', () => {
    const out = relatedQuestionsToPromptSuggestions([
      'a valid question about the brand',
      // @ts-expect-error testing runtime resilience to bad data
      null,
      // @ts-expect-error testing runtime resilience to bad data
      42,
    ])
    expect(out).toHaveLength(1)
  })

  // ─── Relevance filter (regression: prevent topic leak) ─────────────────────

  it('drops off-topic suggestions when relevance anchors are provided', () => {
    // Real-world bug: acasting.se (casting platform) seeded with a stray
    // marketing-agency prompt → Perplexity returned marketing-agency
    // follow-ups. The relevance filter should drop them.
    const out = relatedQuestionsToPromptSuggestions(
      [
        'Vilka är de bästa byråerna för digital marknadsföring i Sverige?',
        'Finns det några svenska byråer som specialiserar sig på video och SEO?',
        'Vilken är den bästa castingplattformen i Sverige?',
        'Hur fungerar acasting.se för skådespelare?',
      ],
      [],
      { relevanceAnchors: ['acasting', 'casting', 'skådespelare'] },
    )
    expect(out.map((s) => s.text)).toEqual([
      'Vilken är den bästa castingplattformen i Sverige?',
      'Hur fungerar acasting.se för skådespelare?',
    ])
  })

  it('relevance anchors are case-insensitive', () => {
    const out = relatedQuestionsToPromptSuggestions(['How does ACASTING price its services?'], [], {
      relevanceAnchors: ['acasting'],
    })
    expect(out).toHaveLength(1)
  })

  it('anchor shorter than 3 chars is ignored (avoids spurious matches)', () => {
    // Anchor 'ai' would otherwise match "fair", "saint", etc.
    const out = relatedQuestionsToPromptSuggestions(
      ['Is the fairground open this weekend?', 'AI brand monitoring tools 2026?'],
      [],
      { relevanceAnchors: ['ai', 'brand'] },
    )
    // Only the 2nd matches via the longer "brand" anchor (≥3 chars).
    expect(out.map((s) => s.text)).toEqual(['AI brand monitoring tools 2026?'])
  })

  it('empty relevanceAnchors disables the filter (legacy behavior preserved)', () => {
    const out = relatedQuestionsToPromptSuggestions(
      ['Totally unrelated question about chess?'],
      [],
      { relevanceAnchors: [] },
    )
    expect(out).toHaveLength(1)
  })

  it('omitting relevanceAnchors disables the filter (back-compat)', () => {
    const out = relatedQuestionsToPromptSuggestions(['Totally unrelated question about chess?'])
    expect(out).toHaveLength(1)
  })
})
