import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type * as MonitoringModule from '../services/monitoring'

/**
 * The daily `brand_health_scores` row is a BRAND aggregate.
 *
 * It was written from inside the per-prompt loop, and the upsert conflicts on
 * `(brand_id, date)` — so each prompt overwrote the previous one and only the
 * last prompt of the run survived. With `CRON_MONITORING_MAX_PROMPTS` at its
 * default of 6, the row was written six times and five were discarded.
 *
 * Nothing about that failed loudly: the row existed, had plausible values, and
 * was read as a whole-brand daily metric by the GEO score, the AVI dashboard
 * widget, the advisor's HEALTH line and the weekly review — all of them
 * describing one arbitrary prompt measured over roughly four engine results.
 *
 * The test that catches it is a count: two prompts on one brand must produce
 * ONE row, built from both.
 */

const { insertSpy, upsertSpy } = vi.hoisted(() => ({ insertSpy: vi.fn(), upsertSpy: vi.fn() }))

vi.mock('@/lib/supabase', () => ({ createServerClient: vi.fn(() => null) }))
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))
vi.mock('@/lib/services/monitoring', async (importOriginal) => {
  const actual = await importOriginal<typeof MonitoringModule>()
  return { ...actual, runMonitoringCheck: vi.fn() }
})
vi.mock('@/lib/services/credits', () => ({
  consumeCreditsForQuery: vi.fn(async () => ({ allowed: true, cost: 0, type: 'unlimited' })),
  CreditServiceError: class extends Error {},
}))
vi.mock('@/lib/services/citation-snapshots', () => ({ calculateCitationSnapshots: vi.fn() }))
vi.mock('@/lib/services/alerts', () => ({
  shouldTriggerAlert: vi.fn(() => false),
  buildAlertEvent: vi.fn(),
  dispatchAlert: vi.fn(),
}))

const CHAIN = [
  'select',
  'eq',
  'or',
  'in',
  'not',
  'gt',
  'lte',
  'order',
  'limit',
  'update',
  'single',
  'maybeSingle',
]

function makeDb(prompts: unknown[]) {
  const thenable = (value: unknown) => {
    const chain: Record<string, unknown> = {}
    for (const m of CHAIN) chain[m] = () => chain
    // Echo the inserted row back: the route pushes what the DB RETURNS into
    // engineResults, so a mock that returns a bare id silently strips every
    // field the aggregate is computed from.
    chain.insert = (row: unknown) => {
      insertSpy(row)
      return thenable({ data: { id: 'r1', ...(row as object) }, error: null })
    }
    chain.upsert = (row: unknown) => {
      upsertSpy(row)
      return thenable({ data: null, error: null })
    }
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(value).then(resolve)
    return chain
  }

  return {
    from: (table: string) => {
      if (table === 'prompts') return thenable({ data: prompts, error: null })
      if (table === 'monitoring_results') return thenable({ data: { id: 'r1' }, error: null })
      return thenable({ data: [], error: null })
    },
  }
}

const BRAND = { id: 'brand-1', name: 'Relovie', is_active: true }
const promptOn = (id: string) => ({
  id,
  user_id: 'owner-1',
  text: `prompt ${id}`,
  engines: ['chatgpt'],
  brand: BRAND,
})

const engineResult = () => ({
  engine: 'chatgpt',
  response_text: 'Relovie is a good option.',
  brand_mentioned: true,
  competitor_mentions: [],
  hallucination_flags: [],
  sentiment_aspects: [],
  cited_urls: [],
  visibility_score: 60,
  sentiment_score: 0.6,
  mention_position: 1,
  has_hallucination: false,
})

describe('cron monitoring — the daily brand health row', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    process.env.CRON_SECRET_TOKEN = 'valid-secret'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('writes one row per brand, not one per prompt', async () => {
    const { createServerClient } = await import('@/lib/supabase')
    vi.mocked(createServerClient).mockReturnValue(
      makeDb([promptOn('prompt-1'), promptOn('prompt-2')]) as never,
    )

    const { runMonitoringCheck } = await import('@/lib/services/monitoring')
    vi.mocked(runMonitoringCheck).mockResolvedValue(engineResult() as never)

    const { POST } = await import('@/app/api/cron/monitoring/route')
    const res = await POST(
      new NextRequest('http://localhost/api/cron/monitoring', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-secret' },
      }),
    )

    expect(res.status).toBe(200)

    const healthRows = upsertSpy.mock.calls
      .map(([row]) => row as Record<string, unknown>)
      .filter((row) => 'avi_score' in row)

    // Two prompts, one brand, one row.
    expect(healthRows).toHaveLength(1)

    // And it is built from BOTH prompts' results, not just the last one.
    expect(healthRows[0]!['mention_count']).toBe(2)
  })
})
