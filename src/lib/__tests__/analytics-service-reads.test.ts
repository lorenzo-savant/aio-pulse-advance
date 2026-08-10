import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * `analytics-service` had no test file at all, and it was the module that
 * carried the write which destroyed data.
 *
 * Both of its read paths used to lazily rebuild snapshots when they found an
 * empty window: `getHistoricalAnalytics` and `getCompetitorComparison` each
 * called `autoGenerateSnapshots`, which upserted the aggregate row with
 * `avg_position: null` and `competitor_rates: {}` hardcoded.
 *
 * The rebuild moved out of the read paths for two reasons that outlive the
 * destructive writer itself:
 *
 *   · The correct writer produces engine × category × language rows — around
 *     120 per date for a brand with a handful of categories and languages.
 *     Doing that for every date in a period, inside a page load, is minutes of
 *     work behind an HTTP handler that can time out mid-write and leave a
 *     partial rebuild.
 *   · Two concurrent page loads both saw an empty window and both started the
 *     same rebuild.
 *
 * These tests pin the invariant: a read is a read. Rebuilding happens in the
 * monitoring cron after each scan, and behind the explicit POST action.
 */

const { writeCalls, snapshotRows } = vi.hoisted(() => ({
  writeCalls: [] as string[],
  snapshotRows: { value: [] as unknown[] },
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/supabase', () => {
  const makeBuilder = (resolve: () => { data: unknown; error: null }) => {
    const builder: Record<string, unknown> = {}
    for (const m of [
      'select',
      'eq',
      'neq',
      'gte',
      'lte',
      'gt',
      'lt',
      'in',
      'not',
      'order',
      'range',
      'limit',
    ]) {
      builder[m] = () => builder
    }
    builder['single'] = async () => resolve()
    builder['maybeSingle'] = async () => resolve()
    builder['then'] = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(resolve()).then(onFulfilled)
    // Any write at all is a failure of the invariant under test, so record
    // every one rather than modelling them.
    for (const m of ['upsert', 'insert', 'update', 'delete']) {
      builder[m] = async () => {
        writeCalls.push(m)
        return { error: null }
      }
    }
    return builder
  }

  return {
    createServerClient: () => ({
      from: (table: string) => {
        if (table === 'citation_snapshots')
          return makeBuilder(() => ({ data: snapshotRows.value, error: null }))
        if (table === 'brands')
          return makeBuilder(() => ({ data: { competitors: [] }, error: null }))
        return makeBuilder(() => ({ data: [], error: null }))
      },
    }),
  }
})

const { getHistoricalAnalytics, getCompetitorComparison } =
  await import('../services/analytics-service')

beforeEach(() => {
  writeCalls.length = 0
  snapshotRows.value = []
})

describe('analytics-service read paths never write', () => {
  it('getHistoricalAnalytics writes nothing when snapshots exist', async () => {
    snapshotRows.value = [
      {
        scan_date: '2026-08-01',
        citation_rate: 50,
        avg_visibility: 70,
        avg_sentiment: 0.4,
        total_prompts: 4,
        brand_citations: 2,
        competitor_rates: {},
      },
    ]

    await getHistoricalAnalytics('brand-1', { metric: 'citations', period: '30d' })

    expect(writeCalls).toEqual([])
  })

  it('INVARIANT: getHistoricalAnalytics writes nothing even when the window is EMPTY', async () => {
    // This is the case that used to trigger the lazy rebuild. An empty window
    // is a legitimate answer, not a prompt to start writing.
    snapshotRows.value = []

    await getHistoricalAnalytics('brand-1', { metric: 'citations', period: '30d' })

    expect(writeCalls).toEqual([])
  })

  it('INVARIANT: getCompetitorComparison writes nothing when the window is EMPTY', async () => {
    snapshotRows.value = []

    await getCompetitorComparison('brand-1', { period: '30d' })

    expect(writeCalls).toEqual([])
  })

  it('no longer exports a snapshot generator — there is one writer, and it lives elsewhere', async () => {
    const mod = await import('../services/analytics-service')
    expect('autoGenerateSnapshots' in mod).toBe(false)
  })
})
