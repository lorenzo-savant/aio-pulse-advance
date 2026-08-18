import { describe, it, expect } from 'vitest'
import { providerMatchesEngine } from '../services/engine-provenance'

// The invariant this file pins: a per-engine statistic only counts rows the
// engine's own provider answered. During the gemini-2.5 retirement week every
// engine=gemini row was served by openai:gpt-4o-mini and still showed up in
// Gemini breakdowns — the exact failure these cases encode.

describe('providerMatchesEngine', () => {
  it('accepts a row answered by the engine own provider family', () => {
    expect(providerMatchesEngine('gemini', 'gemini:flash-3.6+search')).toBe(true)
    expect(providerMatchesEngine('gemini', 'gemini:flash-2.5')).toBe(true)
    expect(providerMatchesEngine('chatgpt', 'openai:gpt-4o-mini+web')).toBe(true)
    expect(providerMatchesEngine('perplexity', 'perplexity:sonar')).toBe(true)
    expect(providerMatchesEngine('claude', 'anthropic:claude-sonnet')).toBe(true)
  })

  it('rejects a fallback-served row — the retirement-week failure mode', () => {
    expect(providerMatchesEngine('gemini', 'openai:gpt-4o-mini')).toBe(false)
    expect(providerMatchesEngine('claude', 'gemini:flash-3.6')).toBe(false)
    expect(providerMatchesEngine('chatgpt', 'perplexity:sonar')).toBe(false)
  })

  it('counts legacy rows (NULL provenance) as matching rather than erasing history', () => {
    expect(providerMatchesEngine('gemini', null)).toBe(true)
    expect(providerMatchesEngine('gemini', undefined)).toBe(true)
    expect(providerMatchesEngine('gemini', '')).toBe(true)
  })

  it('never drops rows for an engine it has no mapping for', () => {
    expect(providerMatchesEngine('all', 'openai:gpt-4o-mini')).toBe(true)
    expect(providerMatchesEngine('unknown-engine', 'gemini:flash-3.6')).toBe(true)
  })
})
