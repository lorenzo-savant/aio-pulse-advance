import { describe, it, expect, vi } from 'vitest'
import { runDeepResearch, planResearch } from '../services/deep-research'
import type { LLMCall } from '../services/prompt-generator-ai'
import type { BraveOrganicResult } from '../services/brave-search'

const fakeLlm = (text: string): ((_s: string, _u: string) => Promise<LLMCall>) =>
  vi.fn(async () => ({ text, provider: 'test', model: 'test-model' }))

const fakeSearch = (
  results: BraveOrganicResult[],
): ((_q: string, _l?: string, _c?: number) => Promise<BraveOrganicResult[]>) =>
  vi.fn(async () => results)

const fakePage = (text: string): ((_u: string) => Promise<string>) => vi.fn(async () => text)

describe('planResearch', () => {
  it('parses one-question-per-line output and strips numbering', async () => {
    const llm = fakeLlm('1. How does X work?\n2. Who uses X?\n')
    const qs = await planResearch('X market', llm, 2)
    expect(qs).toEqual(['How does X work?', 'Who uses X?'])
  })

  it('soft-fails to the topic when the planner output is empty', async () => {
    const llm = fakeLlm('')
    const qs = await planResearch('X market', llm)
    expect(qs).toEqual(['X market'])
  })

  it('caps at 6 sub-questions', async () => {
    const many = Array.from({ length: 9 }, (_, i) => `question number ${i}`).join('\n')
    const llm = fakeLlm(many)
    const qs = await planResearch('topic', llm, 9)
    expect(qs.length).toBeLessThanOrEqual(6)
  })
})

describe('runDeepResearch', () => {
  it('produces a report with deduped cited sources', async () => {
    const llm = fakeLlm('What is X?\nWho uses X?')
    const search = fakeSearch([
      { title: 'Alpha', url: 'https://a.com', rank: 1, description: 'aa' },
      { title: 'Beta', url: 'https://a.com', rank: 2, description: 'dup same url' },
    ])
    const page = fakePage('Readable page text for alpha.')
    const out = await runDeepResearch('X market', {
      llmCaller: llm,
      searchFn: search,
      pageFetcher: page,
    })

    expect(out.subQuestions).toEqual(['What is X?', 'Who uses X?'])
    expect(out.sources.length).toBe(1) // deduped by URL
    expect(out.sources[0]!.url).toBe('https://a.com')
    expect(out.sources[0]!.excerpt).toBe('Readable page text for alpha.')
    expect(out.report).toBeTruthy()
    expect(out.provider).toBe('test')
  })

  it('keeps unreadable pages as sources with null excerpt (soft-fail)', async () => {
    const llm = fakeLlm('How does X work?')
    const search = fakeSearch([{ title: 'A', url: 'https://a.com', rank: 1 }])
    const page = vi.fn(async () => {
      throw new Error('403')
    })
    const out = await runDeepResearch('X', { llmCaller: llm, searchFn: search, pageFetcher: page })
    expect(out.sources[0]!.excerpt).toBeNull()
  })

  it('passes language through to the search function', async () => {
    const llm = fakeLlm('How does X work?')
    const search = fakeSearch([])
    await runDeepResearch('X', {
      llmCaller: llm,
      searchFn: search,
      pageFetcher: fakePage('x'),
      language: 'it',
    })
    expect(search).toHaveBeenCalledWith('How does X work?', 'it', 6)
  })

  it('still produces a report when the search returns nothing', async () => {
    const llm = fakeLlm('How does X work?')
    const out = await runDeepResearch('X', {
      llmCaller: llm,
      searchFn: fakeSearch([]),
      pageFetcher: fakePage('x'),
    })
    expect(out.sources).toEqual([])
    expect(out.report).toBeTruthy()
  })
})
