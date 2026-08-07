#!/usr/bin/env node
// Fail when two modules upsert the same table on the same conflict target.
//
// WHY THIS EXISTS
// `citation_snapshots` had two writers upserting the same row on the same
// conflict key `(brand_id, scan_date, engine, category, language)`. One
// computed `avg_position` and `competitor_rates`; the other wrote `null` and
// `{}` for those same columns as hardcoded literals. A Supabase upsert
// replaces the full column set rather than merging, so whichever ran last won
// and the losing writer's values were gone with no error and no log.
//
// Nothing about that failed loudly. Types could not catch it — both writers
// were type-correct. Tests could not catch it — each writer was correct in
// isolation, and no test ran them in sequence. It is a property of the pair,
// so it needs a check that looks at the pair.
//
// WHAT IS FLAGGED
// Two or more DISTINCT modules upserting the same table on the same
// `onConflict` target with DIFFERENT column sets. That is the precise shape of
// the bug: same row, same key, one writer carrying columns the other does not,
// so the shorter payload erases them.
//
// Two things are deliberately NOT failures:
//
//   · Several modules writing the same table on different keys. Audit logs,
//     counters and caches all have many legitimate writers.
//   · Two modules writing the same key with an IDENTICAL column set. That is
//     duplication, not data loss — whichever runs last writes the same shape.
//     It is reported as debt and exits 0, because a gate that cries wolf is a
//     gate someone switches off.
//
// SAFETY
//   · READ ONLY. Static scan of source text. No database connection, no
//     network, no writes.
//
//   node scripts/audit-table-writers.mjs
//   node scripts/audit-table-writers.mjs --json

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const JSON_OUT = process.argv.includes('--json')
const ROOT = process.cwd()
const SRC = join(ROOT, 'src')

/**
 * Pairs that are known and intended to share a conflict target. Empty by
 * design: if an entry is ever added here it needs a comment explaining why two
 * writers claiming one row is correct, because the default answer is that it
 * is not.
 *
 * Format: 'table:onConflict'
 */
const ALLOWED = new Set([])

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue
      walk(full, out)
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

/**
 * Collect the top-level keys of the object literal starting at `open`, which
 * must be the index of its `{`. Depth-aware so nested objects and arrays do
 * not leak their keys into the result. Returns null when the payload is not a
 * literal — a spread or a variable reference cannot be compared statically.
 */
function objectKeysAt(source, open) {
  if (source[open] !== '{') return null
  const keys = []
  let depth = 0
  let i = open
  let sawSpread = false
  for (; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{' || ch === '[' || ch === '(') depth++
    else if (ch === '}' || ch === ']' || ch === ')') {
      depth--
      if (depth === 0) break
    } else if (depth === 1) {
      if (source.startsWith('...', i)) sawSpread = true
      const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(source.slice(i))
      if (m && /[{,\s]/.test(source[i - 1] ?? '')) {
        keys.push(m[1])
        i += m[0].length - 1
      }
    }
  }
  return sawSpread ? null : keys.sort()
}

/** Index of the first non-whitespace character at or after `i`. */
const skipSpace = (s, i) => {
  while (i < s.length && /\s/.test(s[i])) i++
  return i
}

/**
 * Find every `.upsert(` call, attribute it to the nearest preceding
 * `.from('table')`, and capture both its conflict target and its payload
 * columns. Chains span lines and are formatted freely, so a proximity scan is
 * more robust here than trying to parse the expression.
 */
function findUpsertTargets(source) {
  const hits = []
  const upsertRe = /\.upsert\(/g
  let m
  while ((m = upsertRe.exec(source))) {
    const before = source.slice(0, m.index)
    const table = [...before.matchAll(/\.from\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].at(-1)?.[1]
    if (!table) continue

    // The call's argument list ends at the matching close paren; the conflict
    // target lives inside it.
    const argsStart = m.index + m[0].length
    let depth = 1
    let end = argsStart
    for (; end < source.length && depth > 0; end++) {
      if (source[end] === '(') depth++
      else if (source[end] === ')') depth--
    }
    const args = source.slice(argsStart, end)
    const conflict = /onConflict:\s*['"`]([^'"`]+)['"`]/.exec(args)
    if (!conflict) continue

    hits.push({
      table,
      onConflict: normaliseKey(conflict[1]),
      columns: objectKeysAt(source, skipSpace(source, argsStart)),
      line: before.split('\n').length,
    })
  }
  return hits
}

/** Column order in an onConflict string is not semantically meaningful. */
const normaliseKey = (key) =>
  key
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .sort()
    .join(',')

const files = walk(SRC)
const byTarget = new Map()

for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join('/')
  for (const hit of findUpsertTargets(readFileSync(file, 'utf8'))) {
    const key = `${hit.table}:${hit.onConflict}`
    if (!byTarget.has(key)) byTarget.set(key, new Map())
    const modules = byTarget.get(key)
    if (!modules.has(rel)) modules.set(rel, [])
    modules.get(rel).push(hit)
  }
}

const violations = []
const duplicates = []

for (const [key, modules] of byTarget) {
  if (modules.size < 2 || ALLOWED.has(key)) continue
  const [table, onConflict] = key.split(':')
  const writers = [...modules.entries()].map(([file, hits]) => ({
    file,
    lines: hits.map((h) => h.line),
    columns: hits[0].columns,
  }))

  // Unparseable payloads (spread, variable reference) cannot be compared, so
  // they are treated as potentially divergent rather than waved through.
  const signatures = writers.map((w) => (w.columns ? w.columns.join(',') : null))
  const comparable = signatures.every((s) => s !== null)
  const identical = comparable && new Set(signatures).size === 1

  const entry = { table, onConflict, writers, comparable }
  if (identical) duplicates.push(entry)
  else violations.push(entry)
}

if (JSON_OUT) {
  console.log(JSON.stringify({ targetsScanned: byTarget.size, violations, duplicates }, null, 2))
  process.exit(violations.length ? 1 : 0)
}

console.log(`\nUpsert conflict targets scanned: ${byTarget.size} across ${files.length} files`)

if (duplicates.length) {
  console.log(`\n! ${duplicates.length} target(s) written by two modules with the SAME columns:\n`)
  for (const d of duplicates) {
    console.log(`  ${d.table}  on (${d.onConflict})`)
    for (const w of d.writers) console.log(`      ${w.file}:${w.lines.join(', ')}`)
  }
  console.log(
    '\n  Not a data-loss risk — the payloads are identical, so whichever runs\n' +
      '  last writes the same shape. It is duplication: the two will drift the\n' +
      '  day someone adds a column to one of them. Worth consolidating.',
  )
}

if (!violations.length) {
  console.log('\n✓ No table is upserted by two modules with differing column sets.\n')
  process.exit(0)
}

console.log(`\n✗ ${violations.length} target(s) claimed by writers with DIFFERENT columns:\n`)
for (const v of violations) {
  console.log(`  ${v.table}  on (${v.onConflict})`)
  for (const w of v.writers) {
    console.log(`      ${w.file}:${w.lines.join(', ')}`)
    console.log(`        columns: ${w.columns ? w.columns.join(', ') : '(not statically readable)'}`)
  }
  console.log('')
}
console.log(
  'Two writers upserting the same row by the same key with different column\n' +
    "sets will silently erase each other's values — an upsert replaces the row\n" +
    'rather than merging it. Consolidate to one writer, or add the pair to\n' +
    'ALLOWED in this script with a comment explaining why it is safe.\n',
)
process.exit(1)
