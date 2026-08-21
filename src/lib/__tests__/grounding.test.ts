import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Grounding layer for brand answers.
 *
 * The product's claim is that it measures how accurately AI engines describe a
 * brand, so an advisor that invents an explanation would undermine the very
 * thing it exists to support. These tests pin the two properties that keep that
 * from happening:
 *
 *  - when the rows are not there the caller gets a refusal, so the caller can
 *    never reach a model with an empty context;
 *  - what does come back is traceable — every fact ships with the table and row
 *    count it was drawn from.
 *
 * The read-only property is pinned too: this layer runs on the service-role
 * client, and a stray write here would be invisible until it corrupted
 * something.
 */

const BRAND = '00000000-0000-4000-8000-0000000000b1'

/** Rows each table returns for a given test. */
let tables: Record<string, unknown[]> = {}

/** Any write the code under test attempts, so the read-only claim is testable. */
let writes: string[] = []

function buildChain(table: string) {
  const result = { data: tables[table] ?? [], error: null }
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    order: () => chain,
    limit: () => chain,
    // The queries are awaited at the end of the chain rather than via .single(),
    // so the chain itself has to be thenable.
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    insert: () => {
      writes.push(`insert:${table}`)
      return chain
    },
    update: () => {
      writes.push(`update:${table}`)
      return chain
    },
    upsert: () => {
      writes.push(`upsert:${table}`)
      return chain
    },
    delete: () => {
      writes.push(`delete:${table}`)
      return chain
    },
  }
  return chain
}

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(() => ({ from: vi.fn((table: string) => buildChain(table)) })),
}))

import {
  collectAttributionEvidence,
  collectDeltaEvidence,
  definitionsFor,
  isPillar,
} from '@/lib/agents/grounding'

/** One monitoring row, overridable per test. */
function response(overrides: Record<string, unknown> = {}) {
  return {
    engine: 'chatgpt',
    prompt_text: 'best casting platform in stockholm',
    brand_mentioned: true,
    mention_position: 2,
    mention_type: 'mention',
    cited_urls: [],
    has_hallucination: false,
    confusion_flag: false,
    confusion_reason: null,
    created_at: '2026-08-20T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  tables = {}
  writes = []
})

describe('refusing rather than guessing', () => {
  it('refuses attribution when no monitoring rows exist', async () => {
    tables['monitoring_results'] = []
    const result = await collectAttributionEvidence(BRAND, 'presence', 30, 'en')
    expect(result.grounded).toBe(false)
    if (!result.grounded) expect(result.reason).toBe('no_monitoring_data')
  })

  it('refuses a delta when no snapshots exist', async () => {
    tables['geo_score_snapshots'] = []
    const result = await collectDeltaEvidence(BRAND, 30, 'en')
    expect(result.grounded).toBe(false)
    if (!result.grounded) expect(result.reason).toBe('no_snapshots')
  })

  it('refuses a delta on a single snapshot, because one point is not a trend', async () => {
    tables['geo_score_snapshots'] = [
      { score: 61, grade: 'C', pillars: [], snapshot_date: '2026-08-20' },
    ]
    const result = await collectDeltaEvidence(BRAND, 30, 'en')
    expect(result.grounded).toBe(false)
    if (!result.grounded) expect(result.reason).toBe('not_enough_history')
  })
})

describe('attribution evidence', () => {
  it('explains a position score from where the brand actually appears', async () => {
    tables['monitoring_results'] = [
      response({ mention_position: 2 }),
      response({ mention_position: 8 }),
      response({ mention_position: 9 }),
    ]
    const result = await collectAttributionEvidence(BRAND, 'position', 30, 'en')
    expect(result.grounded).toBe(true)
    if (!result.grounded) return

    // The average and the late-mention count are the two figures that make the
    // number explainable rather than merely restated.
    expect(result.evidence.facts.join(' ')).toContain('6.3')
    expect(result.evidence.facts.some((f) => f.includes('2 of 3'))).toBe(true)
  })

  it('names the engines that never mention the brand', async () => {
    tables['monitoring_results'] = [
      response({ brand_mentioned: true, engine: 'chatgpt' }),
      response({ brand_mentioned: false, engine: 'perplexity' }),
    ]
    const result = await collectAttributionEvidence(BRAND, 'presence', 30, 'en')
    expect(result.grounded).toBe(true)
    if (!result.grounded) return
    expect(result.evidence.facts.join(' ')).toContain('perplexity')
  })

  it('surfaces category confusion, which depresses several pillars at once', async () => {
    tables['monitoring_results'] = [
      response({ confusion_flag: true, confusion_reason: 'described as a reseller' }),
    ]
    const result = await collectAttributionEvidence(BRAND, 'presence', 30, 'en')
    expect(result.grounded).toBe(true)
    if (!result.grounded) return
    expect(result.evidence.facts.join(' ')).toContain('described as a reseller')
  })

  it('carries the table and row count each fact was drawn from', async () => {
    tables['monitoring_results'] = [response(), response()]
    const result = await collectAttributionEvidence(BRAND, 'citation', 30, 'en')
    expect(result.grounded).toBe(true)
    if (!result.grounded) return

    const [source] = result.evidence.provenance
    expect(source?.table).toBe('monitoring_results')
    expect(source?.rowCount).toBe(2)
    expect(source?.detail).toContain('cited_urls')
  })

  it('ships the product’s own definitions, not the model’s idea of them', async () => {
    tables['monitoring_results'] = [response()]
    const result = await collectAttributionEvidence(BRAND, 'citation', 30, 'en')
    expect(result.grounded).toBe(true)
    if (!result.grounded) return
    expect(result.evidence.definitions.length).toBeGreaterThan(0)
  })
})

describe('delta evidence', () => {
  it('attributes the move to the pillars that shifted', async () => {
    tables['geo_score_snapshots'] = [
      {
        score: 70,
        grade: 'B',
        snapshot_date: '2026-08-20',
        sample_size: 40,
        confidence: 'high',
        pillars: [
          { key: 'citation', score: 60 },
          { key: 'position', score: 30 },
        ],
      },
      {
        score: 61,
        grade: 'C',
        snapshot_date: '2026-08-01',
        pillars: [
          { key: 'citation', score: 40 },
          { key: 'position', score: 29.6 },
        ],
      },
    ]
    const result = await collectDeltaEvidence(BRAND, 30, 'en')
    expect(result.grounded).toBe(true)
    if (!result.grounded) return

    const text = result.evidence.facts.join(' ')
    // citation moved 20 points and should be named; position moved four tenths
    // of a point and should not be dressed up as a cause.
    expect(text).toContain('citation')
    expect(text).toContain('+20.0')
    expect(text).not.toContain('Pillar position')
  })

  it('reports the sample size, since it decides whether a move is worth acting on', async () => {
    tables['geo_score_snapshots'] = [
      {
        score: 70,
        grade: 'B',
        snapshot_date: '2026-08-20',
        sample_size: 12,
        confidence: 'low',
        pillars: [],
      },
      { score: 61, grade: 'C', snapshot_date: '2026-08-01', pillars: [] },
    ]
    const result = await collectDeltaEvidence(BRAND, 30, 'en')
    expect(result.grounded).toBe(true)
    if (!result.grounded) return
    expect(result.evidence.facts.join(' ')).toContain('12 responses')
  })
})

describe('read-only guarantee', () => {
  it('never writes while gathering evidence', async () => {
    tables['monitoring_results'] = [response()]
    tables['geo_score_snapshots'] = [
      { score: 70, grade: 'B', snapshot_date: '2026-08-20', pillars: [] },
      { score: 61, grade: 'C', snapshot_date: '2026-08-01', pillars: [] },
    ]
    await collectAttributionEvidence(BRAND, 'trust', 30, 'en')
    await collectDeltaEvidence(BRAND, 30, 'en')
    expect(writes).toEqual([])
  })
})

describe('helpers', () => {
  it('recognises the five pillars and rejects anything else', () => {
    expect(isPillar('citation')).toBe(true)
    expect(isPillar('vibes')).toBe(false)
  })

  it('returns nothing for a section with no help entry', () => {
    expect(definitionsFor('not-a-section', 'en')).toEqual([])
  })

  it('localises definitions', () => {
    expect(definitionsFor('geo-score', 'it')).not.toEqual(definitionsFor('geo-score', 'en'))
  })
})
