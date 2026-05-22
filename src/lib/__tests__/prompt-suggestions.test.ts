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
})
