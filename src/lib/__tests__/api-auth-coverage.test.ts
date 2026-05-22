import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

// ─── Defense-in-depth: API auth-coverage lint ──────────────────────────────
//
// Middleware does NOT enforce auth on /api/* and there is no DB-level RLS on
// the tenant tables — isolation depends entirely on each route handler
// remembering to authenticate. The 2026-05-18 security audit found a whole
// class of routes (findings C-1/C-2) that hit the service-role DB client with
// NO auth, leaking cross-tenant data. This test is the guard the audit asked
// for: any route that uses `createServerClient` MUST reference an auth gate, or
// be explicitly allowlisted as public with a documented reason. A new route
// that forgets auth fails here before it can ship.

const API_ROOT = join(process.cwd(), 'src', 'app', 'api')

// Identifiers that count as an authentication / authorization gate.
const AUTH_GATES = [
  'requireUser', // session gate — src/lib/api-auth
  'getCurrentUserId', // session gate — src/lib/supabase (used directly)
  'verifyCronAuth', // cron-secret gate — src/lib/cron-auth
  'hashApiKey', // v1 public-API key gate — src/lib/services/public-api
  'constructEvent', // Stripe webhook signature verification
] as const

// Routes that legitimately touch the DB WITHOUT a per-caller auth gate.
// Each entry MUST carry a justification — extending this list is a security
// decision, not a convenience.
const PUBLIC_ALLOWLIST: Record<string, string> = {
  'health/route.ts': 'Public health/uptime probe — no tenant data returned.',
  'errors/route.ts': 'Public client-error beacon — body sanitized, no tenant reads.',
  'security/csp-report/route.ts': 'Public CSP-violation beacon — write-only, sanitized.',
  'auth/dev-login/route.ts': 'Dev-only; hard 403 in production (NODE_ENV gate).',
}

function findRouteFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...findRouteFiles(full))
    else if (entry === 'route.ts' || entry === 'route.tsx') out.push(full)
  }
  return out
}

const routeFiles = findRouteFiles(API_ROOT)

describe('API auth coverage (defense-in-depth lint)', () => {
  it('discovers the API route tree', () => {
    expect(routeFiles.length).toBeGreaterThan(20)
  })

  it.each(routeFiles)('%s — DB access is gated behind auth (or allowlisted)', (file) => {
    const src = readFileSync(file, 'utf8')

    // Only routes that reach the service-role DB client are in scope.
    if (!/createServerClient/.test(src)) return

    const rel = relative(API_ROOT, file).split(sep).join('/')
    if (PUBLIC_ALLOWLIST[rel]) return

    const hasGate = AUTH_GATES.some((g) => new RegExp(`\\b${g}\\b`).test(src))
    expect(
      hasGate,
      `\n${rel} calls createServerClient but references no auth gate ` +
        `(one of: ${AUTH_GATES.join(', ')}).\n` +
        `Add requireUser(req) + verifyBrandAccess (see src/app/api/snapshots/route.ts), ` +
        `or — if this endpoint is intentionally public — add it to PUBLIC_ALLOWLIST ` +
        `in this test with a reason.\n`,
    ).toBe(true)
  })
})
