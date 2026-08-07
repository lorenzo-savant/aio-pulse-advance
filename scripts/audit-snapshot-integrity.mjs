#!/usr/bin/env node
// Measure the damage done to citation_snapshots by the dual-writer collision.
//
// WHY THIS EXISTS
// Two functions upsert the same row of citation_snapshots with the same
// conflict key (brand_id, scan_date, engine, category, language):
//
//   · calculateCitationSnapshots (services/citation-snapshots.ts) computes a
//     real avg_position from positioned mentions and real competitor_rates
//     from the brand's competitor list.
//   · autoGenerateSnapshots (services/analytics-service.ts) writes the SAME
//     aggregate row with `avg_position: null` and `competitor_rates: {}`
//     hardcoded.
//
// Supabase upsert replaces the full column set rather than merging, so
// whichever ran last wins. Three API entry points reach the destructive
// writer with no guard at all, one of them looping every writable brand.
//
// This script answers three questions before anything is changed:
//   1. Is the damage confined to the ('all','all','all') aggregate row, as
//      the code reading suggests, or does it reach the per-engine rows too?
//   2. How many aggregate rows currently carry a null avg_position or an
//      empty competitor_rates?
//   3. How many of those are RECOVERABLE — i.e. monitoring_results for that
//      brand and date still hold the positions and competitor mentions the
//      values would be rebuilt from?
//
// SAFETY
//   · READ ONLY. This script has no write path at all. There is no --apply
//     flag because there is nothing to apply.
//   · monitoring_results is the source of truth and is never touched.
//
//   node scripts/audit-snapshot-integrity.mjs
//   node scripts/audit-snapshot-integrity.mjs --json   # machine-readable

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const f of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
}

const JSON_OUT = process.argv.includes('--json')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})

const PAGE = 1000

/** Count rows matching a filter without pulling them. */
async function countWhere(build) {
  const { count, error } = await build(
    db.from('citation_snapshots').select('*', { count: 'exact', head: true }),
  )
  if (error) throw new Error(`count failed: ${error.message}`)
  return count ?? 0
}

/** Page through a select until exhausted. PostgREST caps a single call at 1000. */
async function fetchAll(table, columns, build) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(
      db
        .from(table)
        .select(columns)
        .range(from, from + PAGE - 1),
    )
    if (error) throw new Error(`${table} read failed: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

const isEmptyRates = (v) => v == null || (typeof v === 'object' && Object.keys(v).length === 0)

async function main() {
  // ── 1. Shape of the table ────────────────────────────────────────────────
  const total = await countWhere((q) => q)
  const aggregate = await countWhere((q) =>
    q.eq('engine', 'all').eq('category', 'all').eq('language', 'all'),
  )
  const perEngine = total - aggregate

  // ── 2. Is the damage confined to the aggregate row? ──────────────────────
  // The destructive writer only ever wrote ('all','all','all'). If that is
  // true, per-engine rows should retain their positions at a much higher
  // rate than aggregate rows do.
  const aggNullPos = await countWhere((q) =>
    q.eq('engine', 'all').eq('category', 'all').eq('language', 'all').is('avg_position', null),
  )
  const perEngineNullPos = await countWhere((q) =>
    q.neq('engine', 'all').is('avg_position', null),
  )

  // ── 3. Damaged aggregate rows, with their brand and date ─────────────────
  const damaged = await fetchAll(
    'citation_snapshots',
    'brand_id, scan_date, avg_position, competitor_rates, total_prompts',
    (q) => q.eq('engine', 'all').eq('category', 'all').eq('language', 'all'),
  )

  const nullPosition = damaged.filter((r) => r.avg_position == null)
  const emptyRates = damaged.filter((r) => isEmptyRates(r.competitor_rates))
  const bothLost = damaged.filter((r) => r.avg_position == null && isEmptyRates(r.competitor_rates))

  // ── 4. Recoverability, per brand ─────────────────────────────────────────
  // A row is recoverable when monitoring_results for the same brand and date
  // still hold at least one result with a mention_position. Those are the
  // inputs calculateCitationSnapshots would rebuild avg_position from.
  const brandIds = [...new Set(nullPosition.map((r) => r.brand_id))]
  const recoverableDatesByBrand = new Map()

  for (const brandId of brandIds) {
    const results = await fetchAll(
      'monitoring_results',
      'created_at, mention_position, competitor_mentions',
      (q) => q.eq('brand_id', brandId).not('mention_position', 'is', null),
    )
    const dates = new Set(results.map((r) => String(r.created_at).slice(0, 10)))
    recoverableDatesByBrand.set(brandId, dates)
  }

  const recoverable = nullPosition.filter((r) =>
    recoverableDatesByBrand.get(r.brand_id)?.has(String(r.scan_date).slice(0, 10)),
  )
  const unrecoverable = nullPosition.length - recoverable.length

  // ── 5. Competitor drift warning ──────────────────────────────────────────
  // Rebuilding competitor_rates reads brands.competitors AS THEY ARE TODAY
  // and applies them to historical dates. Report how wide that window is so
  // the provenance decision is made with a number, not a hunch.
  const dateSpan = nullPosition.length
    ? {
        oldest: nullPosition.reduce((a, r) => (r.scan_date < a ? r.scan_date : a), '9999-12-31'),
        newest: nullPosition.reduce((a, r) => (r.scan_date > a ? r.scan_date : a), '0000-01-01'),
      }
    : null

  const report = {
    table: {
      total,
      aggregateRows: aggregate,
      perEngineRows: perEngine,
    },
    damageConfinement: {
      aggregateRowsWithNullPosition: aggNullPos,
      perEngineRowsWithNullPosition: perEngineNullPos,
      note: 'If the destructive writer only touched the aggregate slice, per-engine rows keep their positions.',
    },
    aggregateSlice: {
      rows: damaged.length,
      nullPosition: nullPosition.length,
      emptyCompetitorRates: emptyRates.length,
      bothLost: bothLost.length,
    },
    recovery: {
      recoverableFromMonitoringResults: recoverable.length,
      unrecoverable,
      brandsAffected: brandIds.length,
      dateSpan,
    },
  }

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  const pct = (n, d) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : 'n/a')

  console.log('\ncitation_snapshots — integrity assessment')
  console.log('='.repeat(60))
  console.log(`\nTable shape`)
  console.log(`  total rows                    ${total}`)
  console.log(`  aggregate ('all','all','all') ${aggregate}`)
  console.log(`  per-engine / category / lang  ${perEngine}`)

  console.log(`\nIs the damage confined to the aggregate row?`)
  console.log(
    `  aggregate rows, null position   ${aggNullPos} (${pct(aggNullPos, aggregate)} of aggregate)`,
  )
  console.log(
    `  per-engine rows, null position  ${perEngineNullPos} (${pct(perEngineNullPos, perEngine)} of per-engine)`,
  )
  console.log(
    perEngine > 0 && aggregate > 0 && aggNullPos / aggregate > perEngineNullPos / perEngine + 0.1
      ? '  → CONFIRMED: damage concentrated on the aggregate slice.'
      : '  → NOT confirmed: check whether another writer is involved.',
  )

  console.log(`\nAggregate slice detail`)
  console.log(`  rows                          ${damaged.length}`)
  console.log(`  null avg_position             ${nullPosition.length}`)
  console.log(`  empty competitor_rates        ${emptyRates.length}`)
  console.log(`  both lost                     ${bothLost.length}`)

  console.log(`\nRecovery`)
  console.log(`  recoverable from raw results  ${recoverable.length}`)
  console.log(`  unrecoverable                 ${unrecoverable}`)
  console.log(`  brands affected               ${brandIds.length}`)
  if (dateSpan) {
    console.log(`  date span                     ${dateSpan.oldest} → ${dateSpan.newest}`)
    console.log(
      `\n  NOTE: rebuilding competitor_rates applies TODAY'S competitor list to`,
    )
    console.log(`  every date in that span. Decide provenance before writing.`)
  }
  console.log('')
}

main().catch((err) => {
  console.error('assessment failed:', err.message)
  process.exit(1)
})
