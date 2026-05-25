// PATH: src/lib/__tests__/dataforseo-provider.test.ts
//
// Regression guard for the DataForSEO SERP Live Advanced response parser.
//
// The bug we are pinning: PAA and AI Overview live in NESTED `items[]`
// inside their top-level SERP-feature item, not as flat arrays on the item.
// An earlier parser iterated `item.people_also_ask[]` (a field that does
// not exist) → AEO Snippet generation silently returned 0 questions for
// every keyword. These tests lock in the real shape so future refactors
// don't regress.

import { describe, it, expect } from 'vitest'
import { DataForSEOProvider } from '../providers/dataforseo-provider'

// transformResponse is `protected`. Expose it via a small subclass — same
// pattern used elsewhere in the test suite for protected provider methods.
class TestableProvider extends DataForSEOProvider {
  public callTransform(data: unknown) {
    return this.transformResponse(data)
  }
}

const provider = new TestableProvider()

describe('DataForSEOProvider.transformResponse', () => {
  it('extracts People Also Ask from nested items[].expanded_element[]', () => {
    const dfsResponse = {
      tasks: [
        {
          result: [
            {
              items: [
                {
                  type: 'people_also_ask',
                  rank_group: 5,
                  items: [
                    {
                      type: 'people_also_ask_element',
                      title: 'Vilken är den bästa castingplattformen i Sverige?',
                      expanded_element: [
                        {
                          type: 'people_also_ask_expanded_element',
                          description:
                            'Acasting.se är en av de mest använda plattformarna för casting i Sverige.',
                          title: 'Casting i Sverige — guide',
                          url: 'https://example.se/casting-guide',
                          domain: 'example.se',
                        },
                      ],
                    },
                    {
                      type: 'people_also_ask_element',
                      title: 'Hur lägger jag upp en casting call?',
                      expanded_element: [
                        {
                          description: 'Du kan posta en casting call på flera plattformar.',
                          url: 'https://example.se/post-casting',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }

    const r = provider.callTransform(dfsResponse)
    expect(r.peopleAlsoAsk).toHaveLength(2)
    expect(r.peopleAlsoAsk![0]).toEqual({
      question: 'Vilken är den bästa castingplattformen i Sverige?',
      answer: 'Acasting.se är en av de mest använda plattformarna för casting i Sverige.',
      links: [{ title: 'Casting i Sverige — guide', url: 'https://example.se/casting-guide' }],
    })
    expect(r.peopleAlsoAsk![1]?.question).toBe('Hur lägger jag upp en casting call?')
  })

  it('skips PAA elements with empty titles', () => {
    const r = provider.callTransform({
      tasks: [
        {
          result: [
            {
              items: [
                {
                  type: 'people_also_ask',
                  items: [
                    { type: 'people_also_ask_element', title: '   ', expanded_element: [] },
                    {
                      type: 'people_also_ask_element',
                      title: 'Real question?',
                      expanded_element: [{ description: 'Real answer' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
    expect(r.peopleAlsoAsk).toHaveLength(1)
    expect(r.peopleAlsoAsk![0]?.question).toBe('Real question?')
  })

  it('returns an empty PAA list when DataForSEO returns no PAA box', () => {
    const r = provider.callTransform({
      tasks: [
        {
          result: [
            {
              items: [
                { type: 'organic', rank_group: 1, title: 'A', url: 'https://a.com' },
                { type: 'organic', rank_group: 2, title: 'B', url: 'https://b.com' },
              ],
            },
          ],
        },
      ],
    })
    expect(r.peopleAlsoAsk).toEqual([])
    expect(r.organicResults).toHaveLength(2)
  })

  it('parses AI Overview from inline ai_overview[] payload', () => {
    const r = provider.callTransform({
      tasks: [
        {
          result: [
            {
              items: [
                {
                  type: 'ai_overview',
                  ai_overview: [
                    {
                      text: 'Generated overview text.',
                      links: [{ title: 'Source', url: 'https://src.example' }],
                      expand_questions: ['Q1?', 'Q2?'],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
    expect(r.aiOverviews).toHaveLength(1)
    expect(r.aiOverviews![0]).toMatchObject({
      text: 'Generated overview text.',
      expand_questions: ['Q1?', 'Q2?'],
    })
    expect(r.aiOverviews![0]?.links).toEqual([{ title: 'Source', url: 'https://src.example' }])
  })

  it('parses AI Overview from nested items[] variant (multi-element overview)', () => {
    const r = provider.callTransform({
      tasks: [
        {
          result: [
            {
              items: [
                {
                  type: 'ai_overview',
                  items: [
                    {
                      text: 'First half.',
                      links: [{ title: 'L1', url: 'https://l1.example' }],
                    },
                    {
                      text: 'Second half.',
                      links: [{ title: 'L2', url: 'https://l2.example' }],
                      expand_questions: ['Follow-up?'],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
    expect(r.aiOverviews).toHaveLength(1)
    expect(r.aiOverviews![0]?.text).toBe('First half.\nSecond half.')
    expect(r.aiOverviews![0]?.links).toHaveLength(2)
    expect(r.aiOverviews![0]?.expand_questions).toEqual(['Follow-up?'])
  })

  it('counts organic results and assigns rank from rank_group when present', () => {
    const r = provider.callTransform({
      tasks: [
        {
          result: [
            {
              items: [
                { type: 'organic', rank_group: 1, title: 'A', url: 'https://a.com' },
                { type: 'organic', rank_group: 2, title: 'B', url: 'https://b.com' },
                { type: 'people_also_ask', items: [] }, // skipped
                { type: 'organic', rank_group: 3, title: 'C', url: 'https://c.com' },
              ],
            },
          ],
        },
      ],
    })
    expect(r.organicResults).toHaveLength(3)
    expect(r.searchResultCount).toBe(3)
    expect(r.organicResults!.map((o) => o.rank)).toEqual([1, 2, 3])
  })

  it('returns empty arrays when tasks/result are missing entirely', () => {
    const r = provider.callTransform({})
    expect(r.peopleAlsoAsk).toEqual([])
    expect(r.aiOverviews).toEqual([])
    expect(r.organicResults).toEqual([])
    expect(r.success).toBe(true)
  })
})
