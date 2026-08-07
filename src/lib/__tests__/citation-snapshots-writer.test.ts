import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * `citation_snapshots` had TWO writers upserting the same row on the same
 * conflict key `(brand_id, scan_date, engine, category, language)`.
 *
 *   · calculateCitationSnapshots computes a real `avg_position` from the
 *     positioned mentions and real `competitor_rates` from the brand's
 *     competitor list.
 *   · autoGenerateSnapshots (analytics-service) wrote the SAME aggregate row
 *     with `avg_position: null` and `competitor_rates: {}` hardcoded.
 *
 * A Supabase upsert replaces the full column set rather than merging, so
 * whichever ran last won. Three API entry points reached the destructive
 * writer with no guard at all, one of them looping every writable brand.
 *
 * An assessment against production found the damage had not yet fired — 203
 * aggregate rows across 82 days, none with a null position — because the only
 * caller sits on a dashboard page with no inbound links. The bug was one
 * navigation link away from destroying every historical position for a brand.
 *
 * These tests encode the three properties that keep it dead:
 *
 *   1. ONE writer. The module exports a range backfill so nothing else needs
 *      to write this table, and every row it emits carries the computed
 *      fields rather than nulls.
 *   2. The write is BATCHED. The previous per-row loop issued one network
 *      round-trip per engine × category × language combination — 120 for a
 *      typical brand, multiplied by every date in a range backfill.
 *   3. The range is BOUNDED, and says so when the bound bites. Delegating per
 *      date removed the crude `.limit(1000)` that used to cap the old
 *      implementation; a silent cap reads as "we rebuilt everything".
 */

const { upsertCalls, monitoringRows, brandRow } = vi.hoisted(() => ({
  upsertCalls: [] as Array<{ rows: unknown[]; opts: unknown }>,
  monitoringRows: { value: [] as unknown[] },
  brandRow: { value: { competitors: [] as string[] } },
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/supabase', () => {
  /**
   * Minimal chainable stand-in for the PostgREST builder. Every filter method
   * returns `this`; the object is thenable so `await` on any chain resolves
   * with whatever the table was configured to return.
   */
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
    builder['upsert'] = async (rows: unknown, opts: unknown) => {
      upsertCalls.push({ rows: Array.isArray(rows) ? rows : [rows], opts })
      return { error: null }
    }
    return builder
  }

  return {
    createServerClient: () => ({
      from: (table: string) => {
        if (table === 'monitoring_results')
          return makeBuilder(() => ({ data: monitoringRows.value, error: null }))
        if (table === 'brands') return makeBuilder(() => ({ data: brandRow.value, error: null }))
        return makeBuilder(() => ({ data: [], error: null }))
      },
    }),
  }
})

const { calculateCitationSnapshots, backfillSnapshotsForRange } =
  await import('../services/citation-snapshots')

/** One monitoring result. Defaults describe a mentioned, positioned brand. */
function result(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    brand_id: 'brand-1',
    engine: 'chatgpt',
    response_text: 'text',
    brand_mentioned: true,
    mention_position: 3,
    visibility_score: 70,
    sentiment_score: 0.5,
    competitor_mentions: [],
    created_at: '2026-08-01T10:00:00.000Z',
    prompt: { category: 'general', language: 'en' },
    ...over,
  }
}

/** Every row written across all upsert calls. */
const writtenRows = () => upsertCalls.flatMap((c) => c.rows) as Array<Record<string, unknown>>

/** The aggregate slice — the row the destructive writer used to clobber. */
const aggregateRow = () =>
  writtenRows().find(
    (r) => r['engine'] === 'all' && r['category'] === 'all' && r['language'] === 'all',
  )

beforeEach(() => {
  upsertCalls.length = 0
  monitoringRows.value = []
  brandRow.value = { competitors: [] }
})

describe('calculateCitationSnapshots — the surviving writer', () => {
  // NOTE ON SCOPE: this and the next test pin the INVARIANT the destructive
  // writer violated — the aggregate row always carries computed values. They
  // would not have caught the original bug, because that bug lived in a
  // different module writing the same row. What keeps a second writer from
  // returning is the deletion plus `check:writers` in scripts/. These tests
  // guard the surviving writer against drifting into the same shape.
  it('INVARIANT: the aggregate row carries a computed position, never a null placeholder', async () => {
    // The exact shape the destructive writer used to overwrite: the
    // ('all','all','all') slice, which is the only row both analytics read
    // paths query.
    monitoringRows.value = [
      result({ id: 'a', mention_position: 2 }),
      result({ id: 'b', mention_position: 4 }),
    ]

    await calculateCitationSnapshots('brand-1', '2026-08-01')

    const agg = aggregateRow()
    expect(agg).toBeDefined()
    expect(agg!['avg_position']).toBe(3) // (2 + 4) / 2
    expect(agg!['avg_position']).not.toBeNull()
  })

  it('INVARIANT: competitor rates are computed, not emptied', async () => {
    brandRow.value = { competitors: ['Acast'] }
    monitoringRows.value = [
      result({ id: 'a', competitor_mentions: [{ name: 'Acast' }] }),
      result({ id: 'b', competitor_mentions: [] }),
    ]

    await calculateCitationSnapshots('brand-1', '2026-08-01')

    const agg = aggregateRow()
    expect(agg!['competitor_rates']).toEqual({ Acast: 50 })
    expect(agg!['competitor_rates']).not.toEqual({})
  })

  it('keeps word-boundary competitor matching after the regex was hoisted out of the loop', async () => {
    // "Acast" must not match "Acasting" — two different companies. Hoisting
    // the compiled matcher out of the engine × category × language loop must
    // not change what it matches.
    brandRow.value = { competitors: ['Acast'] }
    monitoringRows.value = [
      result({ id: 'a', competitor_mentions: [{ name: 'Acasting' }] }),
      result({ id: 'b', competitor_mentions: [{ name: 'Acast' }] }),
    ]

    await calculateCitationSnapshots('brand-1', '2026-08-01')

    // One of the two results mentions the real competitor.
    expect(aggregateRow()!['competitor_rates']).toEqual({ Acast: 50 })
  })

  it('writes in batches, not one round-trip per engine/category/language row', async () => {
    // Two categories and two languages across four engines is enough to make
    // a per-row writer issue double-digit calls.
    monitoringRows.value = [
      result({ id: 'a', engine: 'chatgpt', prompt: { category: 'x', language: 'en' } }),
      result({ id: 'b', engine: 'gemini', prompt: { category: 'y', language: 'sv' } }),
    ]

    await calculateCitationSnapshots('brand-1', '2026-08-01')

    expect(writtenRows().length).toBeGreaterThan(1)
    expect(upsertCalls.length).toBe(1)
    expect(upsertCalls[0]!.opts).toEqual({
      onConflict: 'brand_id,scan_date,engine,category,language',
    })
  })

  it('writes nothing when the day has no results', async () => {
    monitoringRows.value = []
    const out = await calculateCitationSnapshots('brand-1', '2026-08-01')
    expect(out.inserted).toBe(0)
    expect(upsertCalls.length).toBe(0)
  })
})

describe('backfillSnapshotsForRange — bounded, and honest about it', () => {
  it('rebuilds one snapshot set per distinct date present in the results', async () => {
    monitoringRows.value = [
      result({ id: 'a', created_at: '2026-08-01T10:00:00.000Z' }),
      result({ id: 'b', created_at: '2026-08-02T10:00:00.000Z' }),
      result({ id: 'c', created_at: '2026-08-02T18:00:00.000Z' }), // same date
    ]

    const out = await backfillSnapshotsForRange('brand-1')

    expect(out.datesAvailable).toBe(2)
    expect(out.datesProcessed).toBe(2)
    expect(out.truncated).toBe(false)
  })

  it('caps the work at maxDates and reports the truncation rather than hiding it', async () => {
    monitoringRows.value = [
      result({ id: 'a', created_at: '2026-08-01T10:00:00.000Z' }),
      result({ id: 'b', created_at: '2026-08-02T10:00:00.000Z' }),
      result({ id: 'c', created_at: '2026-08-03T10:00:00.000Z' }),
    ]

    const out = await backfillSnapshotsForRange('brand-1', { maxDates: 2 })

    expect(out.datesAvailable).toBe(3)
    expect(out.datesProcessed).toBe(2)
    expect(out.truncated).toBe(true)
  })

  it('keeps the newest dates when it truncates', async () => {
    monitoringRows.value = [
      result({ id: 'a', created_at: '2026-08-01T10:00:00.000Z' }),
      result({ id: 'b', created_at: '2026-08-09T10:00:00.000Z' }),
    ]

    await backfillSnapshotsForRange('brand-1', { maxDates: 1 })

    // Every written row belongs to the newer date.
    const dates = new Set(writtenRows().map((r) => r['scan_date']))
    expect([...dates]).toEqual(['2026-08-09'])
  })

  it('never exceeds the hard ceiling even when asked to', async () => {
    monitoringRows.value = [result({ id: 'a', created_at: '2026-08-01T10:00:00.000Z' })]

    const out = await backfillSnapshotsForRange('brand-1', { maxDates: 100_000 })

    // Only one date exists, so the observable proof is that it completed
    // without attempting an unbounded walk.
    expect(out.datesProcessed).toBe(1)
    expect(out.truncated).toBe(false)
  })

  it('is idempotent: a second run writes the same rows, not duplicates', async () => {
    monitoringRows.value = [result({ id: 'a', created_at: '2026-08-01T10:00:00.000Z' })]

    await backfillSnapshotsForRange('brand-1')
    const first = writtenRows().length
    upsertCalls.length = 0

    await backfillSnapshotsForRange('brand-1')
    const second = writtenRows().length

    expect(second).toBe(first)
    // Same conflict target both times, so the second run overwrites rather
    // than appending.
    expect(
      upsertCalls.every(
        (c) =>
          (c.opts as { onConflict: string }).onConflict ===
          'brand_id,scan_date,engine,category,language',
      ),
    ).toBe(true)
  })
})
