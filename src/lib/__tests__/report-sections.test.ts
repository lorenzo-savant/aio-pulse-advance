import { describe, it, expect } from 'vitest'
import {
  buildEngineBreakdown,
  buildCitedDomains,
  buildPromptAnswers,
  type ReportResultRow,
} from '../services/report-sections'

/**
 * The customer-facing report used to show four sections while the product
 * computed a dozen. These builders feed the missing ones, and the behaviours
 * pinned here are the ones a wrong report would get quietly wrong:
 *
 *   · an engine with three responses must not print an authoritative 100%
 *   · the appendix must show the LATEST answer per engine, not the first
 *   · a brand's own domain must be recognised including subdomains
 */

function row(over: Partial<ReportResultRow> = {}): ReportResultRow {
  return {
    engine: 'chatgpt',
    brand_mentioned: true,
    mention_position: 3,
    visibility_score: 70,
    sentiment: 'positive',
    sentiment_score: 0.5,
    cited_urls: [],
    competitor_mentions: [],
    response_text: 'svar',
    prompt_id: 'p1',
    created_at: '2026-08-10T10:00:00Z',
    ...over,
  }
}

describe('buildEngineBreakdown', () => {
  it('computes rate, position and sentiment per engine', () => {
    const rows = [
      ...Array.from({ length: 8 }, (_, i) => row({ mention_position: i % 2 ? 2 : 4 })),
      ...Array.from({ length: 4 }, () =>
        row({ brand_mentioned: false, mention_position: null, sentiment: 'neutral' }),
      ),
    ]
    const [e] = buildEngineBreakdown(rows)

    expect(e!.total).toBe(12)
    expect(e!.mentionRate).toBe(67) // 8/12
    expect(e!.positionAvg).toBe(3) // mean of 2s and 4s, mentioned rows only
    expect(e!.sentiment).toEqual({ positive: 8, neutral: 4, negative: 0 })
  })

  it('drops an engine below the row floor instead of printing confident noise', () => {
    // The real case: a provider key ran out of credit mid-window and produced
    // 4 rows at 100% mention. Shown, that outranks every engine with real
    // volume; a report cannot footnote its way out of a fake headline number.
    const rows = [
      ...Array.from({ length: 12 }, () => row()),
      ...Array.from({ length: 4 }, () => row({ engine: 'claude' })),
    ]
    const out = buildEngineBreakdown(rows)

    expect(out.map((e) => e.engine)).toEqual(['chatgpt'])
  })

  it('never counts unmentioned rows into the position average', () => {
    const rows = [
      ...Array.from({ length: 10 }, () => row({ mention_position: 2 })),
      // an unmentioned row carrying a stray position must not dilute the mean
      row({ brand_mentioned: false, mention_position: 19 }),
    ]
    expect(buildEngineBreakdown(rows)[0]!.positionAvg).toBe(2)
  })
})

describe('buildCitedDomains', () => {
  it('ranks domains, strips www, and flags the brand own domain including subdomains', () => {
    const rows = [
      row({ cited_urls: ['https://www.relovie.com/a', 'https://blog.relovie.com/b'] }),
      row({ cited_urls: ['https://tradera.com/x'] }),
      row({ cited_urls: ['https://tradera.com/y', 'not a url'] }),
    ]
    const out = buildCitedDomains(rows, 'relovie.com')

    expect(out.totalCitations).toBe(4) // the fragment is skipped, not guessed at
    expect(out.top[0]).toMatchObject({ domain: 'tradera.com', count: 2, isOwn: false })
    expect(out.top.find((d) => d.domain === 'relovie.com')?.isOwn).toBe(true)
    expect(out.top.find((d) => d.domain === 'blog.relovie.com')?.isOwn).toBe(true)
  })

  it('groups citation volume by authority category', () => {
    const rows = [row({ cited_urls: ['https://reddit.com/r/x', 'https://shop.example.com/p'] })]
    const out = buildCitedDomains(rows, null)

    const cats = Object.fromEntries(out.byCategory.map((c) => [c.category, c.count]))
    expect(cats['community']).toBe(1)
    expect(cats['commercial']).toBe(1)
  })
})

describe('buildPromptAnswers', () => {
  const prompts = [
    { id: 'p1', text: 'Vad är Relovie?', category: 'awareness', language: 'sv' },
    { id: 'p2', text: 'Aldrig körd', category: 'awareness', language: 'sv' },
  ]

  it('returns the LATEST answer per engine, not the first', () => {
    const rows = [
      row({ prompt_id: 'p1', response_text: 'gammalt svar', created_at: '2026-08-01T10:00:00Z' }),
      row({ prompt_id: 'p1', response_text: 'nytt svar', created_at: '2026-08-10T10:00:00Z' }),
    ]
    const [p] = buildPromptAnswers(rows, prompts, ['chatgpt'])

    expect(p!.answers).toHaveLength(1)
    expect(p!.answers[0]!.responseText).toBe('nytt svar')
    expect(p!.runs).toBe(2)
  })

  it('omits prompts that never ran instead of rendering empty blocks', () => {
    const rows = [row({ prompt_id: 'p1' })]
    const out = buildPromptAnswers(rows, prompts, ['chatgpt'])

    expect(out.map((p) => p.promptId)).toEqual(['p1'])
  })

  it('orders answers by the given engine order and skips engines with no text', () => {
    const rows = [
      row({ prompt_id: 'p1', engine: 'perplexity' }),
      row({ prompt_id: 'p1', engine: 'chatgpt' }),
      row({ prompt_id: 'p1', engine: 'gemini', response_text: null }),
    ]
    const [p] = buildPromptAnswers(rows, prompts, ['chatgpt', 'gemini', 'perplexity'])

    expect(p!.answers.map((a) => a.engine)).toEqual(['chatgpt', 'perplexity'])
  })

  it('sorts prompts by mention rate so the strongest results lead', () => {
    const rows = [row({ prompt_id: 'p1', brand_mentioned: false }), row({ prompt_id: 'p2' })]
    const out = buildPromptAnswers(
      rows,
      [
        { id: 'p1', text: 'svag' },
        { id: 'p2', text: 'stark' },
      ],
      ['chatgpt'],
    )
    expect(out.map((p) => p.text)).toEqual(['stark', 'svag'])
  })
})
