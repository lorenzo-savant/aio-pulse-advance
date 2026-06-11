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

// Write handlers that legitimately need NO zod body validator. Keep this list
// short and justified — each entry is a route whose integrity comes from
// something other than a JSON-body schema. Matched as a path suffix so it works
// regardless of OS path separators / absolute prefix.
const EXEMPT_SUFFIXES = [
  // Vercel cron endpoints: no user-supplied body; authed by verifyCronAuth.
  'api/cron/aeo-bridge/route.ts',
  'api/cron/brightdata-sync/route.ts',
  'api/cron/digest/route.ts',
  'api/cron/geo-analysis/route.ts',
  'api/cron/gsc-sync/route.ts',
  'api/cron/keyword-refresh/route.ts',
  'api/cron/monitoring/route.ts',
  'api/cron/report-delivery/route.ts',
  'api/cron/weekly-review/route.ts',
  // Stripe webhook: integrity is the HMAC signature, not a body schema.
  'api/billing/webhook/route.ts',
  // API root: POST/PATCH/PUT/DELETE all return version info; no body is read.
  'api/v1/route.ts',
  // Sentry demo endpoint: intentionally throws; not a real input handler.
  'api/sentry-example-api/route.ts',
  // Provider test/health triggers: authenticated POSTs that run fixed probes
  // and read NO request body — there is nothing to validate.
  'api/providers/route.ts',
  'api/providers/test/route.ts',
  'api/providers/health/route.ts',
  // Dev-only credential bootstrap: takes no body, hard-blocked in production.
  'api/auth/dev-login/route.ts',
]

const isExempt = (route) => {
  const norm = route.replace(/\\/g, '/')
  return EXEMPT_SUFFIXES.some((s) => norm.endsWith(s))
}

const routes = walk(API_ROOT)
const missing = []
const writeHandlers = []
let exemptCount = 0

for (const route of routes) {
  const content = readFileSync(route, 'utf8')
  if (!WRITE_VERB.test(content)) continue // GET-only routes — skip
  if (isExempt(route)) {
    exemptCount++
    continue // legitimately exempt — not counted in the coverage denominator
  }
  writeHandlers.push(route)
  if (!VALIDATOR.test(content)) missing.push(route)
}

const rel = (p) => p.replace(process.cwd() + '/', '').replace(/\\/g, '/')
const total = writeHandlers.length
const covered = total - missing.length

console.log(
  `Zod validation coverage: ${covered}/${total} write handlers (${Math.round((covered / total) * 100)}%)` +
    ` — ${exemptCount} exempt (cron / signature-verified / no-body)`,
)
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
