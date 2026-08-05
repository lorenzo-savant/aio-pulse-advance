#!/usr/bin/env node
// Recompute brand_health_scores from the monitoring_results they were derived
// from, using the CURRENT formula.
//
// WHY THIS EXISTS
// The AVI formula was wrong in three ways and is now fixed:
//   · recommendationRate was a byte-identical copy of mentionFrequency, so one
//     signal drove 40% of the score under two names
//   · a brand no engine had ever named scored a floor of exactly 25.0/100 from
//     three missing-data substitutions
//   · mention_position is a SENTENCE INDEX up to 20 and was normalised as a
//     1-5 rank, so everything from the fifth sentence on scored zero
//
// 192 of 194 stored rows carry values from the old formula. New scans write
// correct ones beside them, so every chart is about to show a step that no
// change in the world caused.
//
// SAFETY
//   · DRY RUN BY DEFAULT. Writes nothing unless --apply is passed.
//   · UPDATE only, on score columns only. No insert, no delete, no schema
//     change. A row that cannot be recomputed is skipped, never zeroed.
//   · Every row is recomputed from monitoring_results, which is untouched and
//     remains the source of truth. If this is ever wrong, run it again after
//     fixing the formula — the inputs are still there.
//
//   node scripts/recalc-health-scores.mjs            # measure, change nothing
//   node scripts/recalc-health-scores.mjs --apply    # write

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

const APPLY = process.argv.includes('--apply')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})

// Mirrors src/lib/services/monitoring.ts. Kept in this file rather than
// imported because the app is TypeScript behind a path alias; the constants are
// asserted against the source below so the two cannot drift silently.
const WEIGHTS = {
  citationRate: 0.2,
  mentionFrequency: 0.2,
  sentimentScore: 0.15,
  recommendationRate: 0.2,
  positionAvg: 0.15,
  hallucinationIndex: 0.1,
}
const POSITION_SCALE_MAX = 20
const POSITIVE_SENTIMENT_THRESHOLD = 0.2

const src = readFileSync('src/lib/services/monitoring.ts', 'utf8')
for (const [k, v] of Object.entries(WEIGHTS)) {
  if (!new RegExp(`${k}:\\s*${v}\\b`).test(src)) {
    console.error(`ABORT: weight ${k}=${v} no longer matches monitoring.ts`)
    process.exit(1)
  }
}
if (!src.includes(`POSITION_SCALE_MAX = ${POSITION_SCALE_MAX}`)) {
  console.error('ABORT: POSITION_SCALE_MAX no longer matches monitoring.ts')
  process.exit(1)
}

function calculateAVI({
  citationRate,
  mentionFrequency,
  sentimentScore,
  recommendationRate,
  positionAvg,
  hallucinationIndex,
}) {
  // A null contributes nothing and claims no weight — the rate is over the
  // components that had a reading, not over all six.
  const parts = []
  const add = (value, weight) => {
    if (value != null) parts.push([value, weight])
  }
  add(citationRate, WEIGHTS.citationRate)
  add(mentionFrequency, WEIGHTS.mentionFrequency)
  add(
    sentimentScore == null ? null : ((Math.max(-1, Math.min(1, sentimentScore)) + 1) / 2) * 100,
    WEIGHTS.sentimentScore,
  )
  add(recommendationRate, WEIGHTS.recommendationRate)
  add(
    positionAvg == null || positionAvg <= 0
      ? null
      : Math.max(0, Math.min(100, ((POSITION_SCALE_MAX - positionAvg) / (POSITION_SCALE_MAX - 1)) * 100)),
    WEIGHTS.positionAvg,
  )
  add(hallucinationIndex == null ? null : Math.max(0, 100 - hallucinationIndex), WEIGHTS.hallucinationIndex)

  if (parts.length === 0) return null
  const totalWeight = parts.reduce((s, [, w]) => s + w, 0)
  const weighted = parts.reduce((s, [v, w]) => s + v * w, 0)
  return Math.round((weighted / totalWeight) * 10) / 10
}

function componentsFor(rows) {
  const total = rows.length
  const mentioned = rows.filter((r) => r.brand_mentioned)
  if (total === 0 || mentioned.length === 0) {
    return {
      citationRate: 0,
      mentionFrequency: 0,
      sentimentScore: 0,
      recommendationRate: 0,
      positionAvg: 0,
      hallucinationIndex: 0,
      avi: 0,
    }
  }

  const withSentiment = mentioned.filter((r) => r.sentiment_score != null)
  const recommended = withSentiment.filter(
    (r) => (r.sentiment_score ?? 0) >= POSITIVE_SENTIMENT_THRESHOLD,
  )
  const cited = rows.filter(
    (r) => r.cited_urls?.length > 0 && r.citation_source !== 'brave_fallback',
  )
  const assessed = rows.filter((r) => r.has_hallucination != null)
  const hallucinated = assessed.filter((r) => r.has_hallucination)
  const positions = mentioned
    .map((r) => r.mention_position)
    .filter((p) => p != null && p > 0)

  const components = {
    citationRate: (cited.length / total) * 100,
    mentionFrequency: (mentioned.length / total) * 100,
    sentimentScore:
      withSentiment.length > 0
        ? withSentiment.reduce((a, r) => a + (r.sentiment_score ?? 0), 0) / withSentiment.length
        : null,
    recommendationRate: withSentiment.length > 0 ? (recommended.length / total) * 100 : null,
    positionAvg: positions.length > 0 ? positions.reduce((a, p) => a + p, 0) / positions.length : 0,
    hallucinationIndex: assessed.length > 0 ? (hallucinated.length / assessed.length) * 100 : null,
  }
  return { ...components, avi: calculateAVI(components) }
}

const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10)

// ── Load ──────────────────────────────────────────────────────────────────
const { data: stored, error: storedErr } = await db
  .from('brand_health_scores')
  .select('id, brand_id, date, avi_score, health_score, recommendation_rate, mention_rate')
  .order('date', { ascending: true })
if (storedErr) {
  console.error('ABORT: could not read brand_health_scores —', storedErr.message)
  process.exit(1)
}

const { data: brands } = await db.from('brands').select('id, name')
const brandName = new Map((brands ?? []).map((b) => [b.id, b.name]))

console.log(APPLY ? '*** APPLYING ***' : 'DRY RUN — nothing will be written')
console.log(`${stored.length} stored rows\n`)

const changes = []
let skipped = 0

for (const row of stored) {
  const dayStart = `${row.date}T00:00:00`
  const dayEnd = `${row.date}T23:59:59.999`
  const { data: results, error } = await db
    .from('monitoring_results')
    .select(
      'brand_mentioned, sentiment_score, cited_urls, citation_source, has_hallucination, mention_position',
    )
    .eq('brand_id', row.brand_id)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)

  // No inputs left for that day → leave the stored value alone. Overwriting it
  // with a computed zero would replace a real old number with a fake new one.
  if (error || !results || results.length === 0) {
    skipped++
    continue
  }

  const next = componentsFor(results)
  const before = row.avi_score ?? row.health_score
  const after = next.avi
  if (after == null) {
    skipped++
    continue
  }
  if (Math.abs((before ?? 0) - after) < 0.05) continue

  changes.push({
    id: row.id,
    brand: brandName.get(row.brand_id) ?? row.brand_id,
    date: row.date,
    before: round1(before),
    after: round1(after),
    delta: round1(after - (before ?? 0)),
    rows: results.length,
    next,
  })
}

console.log(`${changes.length} rows would change · ${skipped} skipped (no inputs for that day)\n`)

const byBrand = new Map()
for (const c of changes) {
  const list = byBrand.get(c.brand) ?? []
  list.push(c)
  byBrand.set(c.brand, list)
}
for (const [brand, list] of byBrand) {
  const deltas = list.map((c) => c.delta)
  const avg = round1(deltas.reduce((s, d) => s + d, 0) / deltas.length)
  console.log(
    `${brand.padEnd(26)} ${String(list.length).padStart(3)} rows  avg ${avg > 0 ? '+' : ''}${avg}  ` +
      `range ${round1(Math.min(...deltas))} … ${round1(Math.max(...deltas))}`,
  )
  for (const c of list.slice(0, 3)) {
    console.log(`    ${c.date}  ${c.before} → ${c.after}  (${c.rows} results)`)
  }
  if (list.length > 3) console.log(`    … ${list.length - 3} more`)
}

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to write these values.')
  process.exit(0)
}

// Snapshot every row about to change, before changing any of it. There is no
// DDL access from here to make a backup table, so this writes a file — which
// is enough, because the restore is an UPDATE per id with the values below.
// Without it this operation is irreversible, and 173 rows of client-facing
// history is not something to overwrite on the strength of one dry run.
const { writeFileSync } = await import('node:fs')
const stamp = stored.length && changes.length ? changes[0].date : 'unknown'
const backupPath = `brand_health_scores.backup.${stamp}.json`
const { data: fullRows } = await db
  .from('brand_health_scores')
  .select('*')
  .in(
    'id',
    changes.map((c) => c.id),
  )
writeFileSync(backupPath, JSON.stringify(fullRows ?? [], null, 2), 'utf8')
console.log(`\nBacked up ${(fullRows ?? []).length} rows to ${backupPath} before writing.`)
if ((fullRows ?? []).length !== changes.length) {
  console.error('ABORT: backup row count does not match the change set. Nothing written.')
  process.exit(1)
}

let written = 0
for (const c of changes) {
  const { error } = await db
    .from('brand_health_scores')
    .update({
      avi_score: round1(c.next.avi),
      health_score: round1(c.next.avi),
      citation_rate: round1(c.next.citationRate),
      mention_rate: round1(c.next.mentionFrequency),
      recommendation_rate: round1(c.next.recommendationRate),
      position_avg: round1(c.next.positionAvg),
      sentiment_score: round1(c.next.sentimentScore),
    })
    .eq('id', c.id)
  if (error) {
    console.error(`  FAILED ${c.brand} ${c.date}: ${error.message}`)
    continue
  }
  written++
}
console.log(`\nWrote ${written} of ${changes.length} rows.`)
