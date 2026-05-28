#!/usr/bin/env node
/* eslint-disable no-console */
//
// Audit: which API route handlers (POST/PATCH/PUT/DELETE) lack zod runtime
// validation on their incoming body. TypeScript types protect at compile time
// but anyone can POST arbitrary JSON — runtime validation is the only line of
// defense against malformed input.
//
// Usage:
//   node scripts/audit-zod-coverage.mjs            → report only
//   node scripts/audit-zod-coverage.mjs --strict   → exit 1 on any missing
//
// Output is the list of file paths that should add `safeParse` / `parse` from
// a zod schema. Read-only handlers (GET, HEAD, OPTIONS) are ignored — they
// don't accept a body.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const API_ROOT = join(process.cwd(), 'src', 'app', 'api')

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (entry === 'route.ts' || entry === 'route.tsx') out.push(p)
  }
  return out
}

const WRITE_VERB = /export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)\b/
// Heuristics: any of these patterns in the file is "good enough" to call the
// handler validated. We don't try to verify the schema is correct — just that
// the developer reached for a runtime validator.
const VALIDATOR = /(\bsafeParse\s*\(|\b\.parse\s*\(\s*body|\bz\.object\s*\(|\bzod\.object\s*\(|from\s+['"]@\/lib\/validations['"])/

const routes = walk(API_ROOT)
const missing = []
const writeHandlers = []

for (const route of routes) {
  const content = readFileSync(route, 'utf8')
  if (!WRITE_VERB.test(content)) continue // GET-only routes — skip
  writeHandlers.push(route)
  if (!VALIDATOR.test(content)) missing.push(route)
}

const rel = (p) => p.replace(process.cwd() + '/', '').replace(/\\/g, '/')
const total = writeHandlers.length
const covered = total - missing.length

console.log(`Zod validation coverage: ${covered}/${total} write handlers (${Math.round((covered / total) * 100)}%)`)
console.log('')
if (missing.length === 0) {
  console.log('✓ All write handlers have a zod validator.')
  process.exit(0)
}

console.log(`Routes missing runtime validation (${missing.length}):`)
for (const m of missing) console.log(`  - ${rel(m)}`)

if (process.argv.includes('--strict')) {
  console.log('')
  console.log('FAIL: --strict mode and some handlers are uncovered.')
  process.exit(1)
}
