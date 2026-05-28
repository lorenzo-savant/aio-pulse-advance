#!/usr/bin/env node
/* eslint-disable no-console */
//
// Audit: every `CREATE TABLE` in supabase/migrations has a matching
// `ENABLE ROW LEVEL SECURITY` somewhere in the migration history. Without
// RLS, a table is wide open to any authenticated client. Catching this in
// CI avoids the "we shipped without RLS for 3 weeks" footgun.
//
// Note this is a static check — for the authoritative answer hit the live
// database with:
//
//   select schemaname, tablename
//   from pg_tables
//   where schemaname = 'public'
//     and not relrowsecurity::boolean
//   from pg_class where relname = tablename;
//
// Static is good enough for the migration repo and works in CI without
// secrets.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations')

const CREATE_TABLE = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi
const ENABLE_RLS = /alter\s+table\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+enable\s+row\s+level\s+security/gi

const created = new Set()
const rlsEnabled = new Set()

for (const f of readdirSync(MIGRATIONS_DIR).sort()) {
  if (!f.endsWith('.sql')) continue
  const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf8')
  // Strip line comments so commented-out CREATE TABLE doesn't trigger us.
  const clean = sql.replace(/--.*$/gm, '')

  for (const m of clean.matchAll(CREATE_TABLE)) created.add(m[1].toLowerCase())
  for (const m of clean.matchAll(ENABLE_RLS)) rlsEnabled.add(m[1].toLowerCase())
}

// Tables that are intentionally exempt from RLS — they're either system tables
// owned by Supabase or read-only reference tables exposed via PostgREST grants
// without per-user policies. Add justifications inline.
const EXEMPT = new Set([
  // None currently — flip below if a legitimate exemption is added.
])

const missing = [...created].filter((t) => !rlsEnabled.has(t) && !EXEMPT.has(t)).sort()

console.log(`RLS coverage: ${created.size - missing.length}/${created.size} public tables`)
console.log('')

if (missing.length === 0) {
  console.log('✓ Every CREATE TABLE has a matching ENABLE ROW LEVEL SECURITY.')
  process.exit(0)
}

console.log(`Tables without RLS (${missing.length}):`)
for (const t of missing) console.log(`  - public.${t}`)
console.log('')
console.log('Add an `ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY;` to the migration that created it,')
console.log('or add the table to the EXEMPT set in this script with a justification.')

if (process.argv.includes('--strict')) process.exit(1)
