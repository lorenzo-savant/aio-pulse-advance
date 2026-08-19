import { describe, it, expect } from 'vitest'
import {
  classifyPromptCategory,
  isBrandedPrompt,
  isPromptScope,
  scopeRowsByBrandedness,
} from '../services/prompt-classification'

const RELOVIE = { name: 'Relovie', aliases: ['Relovie AB'], domain: 'relovie.se' }

describe('isBrandedPrompt', () => {
  it('recognises the brand name anywhere in the question', () => {
    expect(isBrandedPrompt('Är Relovie bra för begagnad elektronik?', RELOVIE)).toBe(true)
    expect(isBrandedPrompt('what does relovie sell', RELOVIE)).toBe(true)
  })

  it('recognises an alias and the domain', () => {
    expect(isBrandedPrompt('Vad tycker folk om Relovie AB?', RELOVIE)).toBe(true)
    expect(isBrandedPrompt('Is relovie.se trustworthy?', RELOVIE)).toBe(true)
  })

  it('treats a discovery question as non-branded', () => {
    expect(
      isBrandedPrompt('Vilka sajter är bäst för att köpa begagnad elektronik i Sverige?', RELOVIE),
    ).toBe(false)
  })

  it('does not match the brand inside a longer word', () => {
    // The canonical trap in this repo: "Acast" must never match "Acasting".
    expect(isBrandedPrompt('Which acasting services exist?', { name: 'Acast' })).toBe(false)
    expect(isBrandedPrompt('Is Acast worth it?', { name: 'Acast' })).toBe(true)
  })

  it('handles empty input without guessing', () => {
    expect(isBrandedPrompt('', RELOVIE)).toBe(false)
    expect(isBrandedPrompt(null, RELOVIE)).toBe(false)
    expect(isBrandedPrompt('Relovie', { name: '' })).toBe(false)
  })
})

describe('scopeRowsByBrandedness', () => {
  const rows = [
    { prompt_text: 'Är Relovie bra?', id: 1 },
    { prompt_text: 'Bästa sajter för begagnat i Sverige?', id: 2 },
    { prompt_text: 'Var köper man begagnad elektronik?', id: 3 },
  ]

  it('returns only the requested population', () => {
    expect(scopeRowsByBrandedness(rows, RELOVIE, 'branded').rows.map((r) => r.id)).toEqual([1])
    expect(scopeRowsByBrandedness(rows, RELOVIE, 'non_branded').rows.map((r) => r.id)).toEqual([
      2, 3,
    ])
    expect(scopeRowsByBrandedness(rows, RELOVIE, 'all').rows).toHaveLength(3)
  })

  it('reports both counts whichever scope was asked for', () => {
    // A filtered average is only readable next to how much data it covers.
    for (const scope of ['all', 'branded', 'non_branded'] as const) {
      const r = scopeRowsByBrandedness(rows, RELOVIE, scope)
      expect(r.brandedCount).toBe(1)
      expect(r.nonBrandedCount).toBe(2)
    }
  })

  it('treats a row with no prompt text as non-branded rather than dropping it', () => {
    const r = scopeRowsByBrandedness([{ prompt_text: null }], RELOVIE, 'non_branded')
    expect(r.rows).toHaveLength(1)
  })
})

describe('isPromptScope', () => {
  it('accepts the three scopes and nothing else', () => {
    expect(isPromptScope('all')).toBe(true)
    expect(isPromptScope('branded')).toBe(true)
    expect(isPromptScope('non_branded')).toBe(true)
    expect(isPromptScope('nonbranded')).toBe(false)
    expect(isPromptScope(undefined)).toBe(false)
  })
})

describe('classifyPromptCategory', () => {
  it('reads a comparison in any of the three product languages', () => {
    expect(classifyPromptCategory('Relovie vs Tradera — vilket är bäst?', RELOVIE)).toBe(
      'comparison',
    )
    expect(classifyPromptCategory('Qual è la differenza tra Relovie e Vinted?', RELOVIE)).toBe(
      'comparison',
    )
    expect(classifyPromptCategory('How is Relovie compared to Sellpy?', RELOVIE)).toBe('comparison')
  })

  it('reads alternatives and feature questions', () => {
    expect(classifyPromptCategory('Alternatives to Blocket for used electronics', RELOVIE)).toBe(
      'alternative',
    )
    expect(classifyPromptCategory('Vad kostar det att sälja på Relovie?', RELOVIE)).toBe('features')
  })

  it('calls a brand-naming question awareness', () => {
    expect(classifyPromptCategory('Är Relovie ett seriöst företag?', RELOVIE)).toBe('awareness')
  })

  it('lands anything without a signal in custom, not in awareness', () => {
    // The whole point of C4: 'awareness' stopped meaning anything because
    // everything unrecognised was dropped into it.
    expect(classifyPromptCategory('Vilka sajter är bäst för begagnad elektronik?', RELOVIE)).toBe(
      'custom',
    )
    expect(classifyPromptCategory('', RELOVIE)).toBe('custom')
  })

  it('prefers the sharper signal when a prompt is both branded and comparative', () => {
    expect(classifyPromptCategory('Is Relovie better than Tradera?', RELOVIE)).toBe('comparison')
  })

  it('does not fire on a token inside another word', () => {
    // ' vs ' is padded, so "CVS pharmacy" is not a comparison.
    expect(classifyPromptCategory('Where is the nearest CVS pharmacy?', RELOVIE)).toBe('custom')
  })
})

describe('classifyPromptCategory — patterns found in real stored prompts', () => {
  it('reads "how do X and Y differ" as a comparison', () => {
    expect(
      classifyPromptCategory('Hur skiljer sig Sellpy, Tradera och Vinted från Relovie?', RELOVIE),
    ).toBe('comparison')
  })

  it('reads "A or B — which is best?" as a comparison', () => {
    expect(classifyPromptCategory('Relovie eller Tradera – vilket är bäst?', RELOVIE)).toBe(
      'comparison',
    )
    expect(classifyPromptCategory('Relovie or Tradera — which is better?', RELOVIE)).toBe(
      'comparison',
    )
  })

  it('does not call a plain disjunction a comparison', () => {
    // ' or ' alone is far too common; it only counts next to a superlative.
    expect(classifyPromptCategory('Do they ship to Sweden or Norway?', RELOVIE)).toBe('custom')
  })
})
