import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'

/**
 * ANTI-REGRESSION GUARD (defense-in-depth replacement for DB RLS).
 *
 * The app accesses the DB with the Supabase SERVICE-ROLE client
 * (`createServerClient`), which bypasses any Row-Level Security. Tenant
 * isolation therefore depends ENTIRELY on every API route handler
 * authenticating the caller before touching the DB.
 *
 * This test fails the build if any `src/app/api/**\/route.ts` uses
 * `createServerClient` without also using a recognized auth mechanism.
 * It is the codified form of the C-1/C-2 fixes — a new route that forgets
 * auth can no longer ship silently.
 *
 * If you add a genuinely public route that needs the DB, add it to
 * PUBLIC_ROUTES below WITH a justification comment.
 */

const API_DIR = path.resolve(__dirname, '../../app/api')

// Recognized auth gates. A route that touches the DB must reference at
// least one of these.
const AUTH_TOKENS = [
  'requireUser', // standard session auth (src/lib/api-auth)
  'getCurrentUserId', // raw session auth (src/lib/supabase)
  'verifyCronAuth', // constant-time cron secret (src/lib/cron-auth)
  'verifyApiKey', // public API key auth (v1 routes / api-key-auth)
]

// Routes that are intentionally public and may use the DB WITHOUT user auth.
// Each entry MUST have a one-line justification.
const PUBLIC_ROUTES = new Set<string>([
  'billing/webhook/route.ts', // Stripe webhook — authenticated by Stripe signature
  'errors/route.ts', // client error beacon — intentionally unauth, input-sanitized
  'health/route.ts', // public health/readiness probe — no tenant data
  'security/csp-report/route.ts', // CSP violation collector — public by spec
  'auth/dev-login/route.ts', // dev-only demo login — early-returns 403 in production (NODE_ENV check)
])

function walkRouteFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...walkRouteFiles(full))
    } else if (entry === 'route.ts' || entry === 'route.tsx') {
      out.push(full)
    }
  }
  return out
}

describe('API auth guard: every DB-touching route must authenticate', () => {
  const routeFiles = walkRouteFiles(API_DIR)

  it('discovers route files', () => {
    expect(routeFiles.length).toBeGreaterThan(0)
  })

  it('has no route using createServerClient without an auth gate', () => {
    const offenders: string[] = []

    for (const file of routeFiles) {
      const rel = path.relative(API_DIR, file).split(path.sep).join('/')
      const src = readFileSync(file, 'utf8')

      const usesDb = /\bcreateServerClient\b/.test(src)
      if (!usesDb) continue

      const hasAuth = AUTH_TOKENS.some((t) => new RegExp(`\\b${t}\\b`).test(src))
      if (hasAuth) continue

      if (PUBLIC_ROUTES.has(rel)) continue

      offenders.push(rel)
    }

    if (offenders.length > 0) {
      throw new Error(
        `These API routes use the service-role DB client without an auth gate ` +
          `(${AUTH_TOKENS.join(' / ')}). Add authentication, or — only if the ` +
          `route is genuinely public — add it to PUBLIC_ROUTES with a ` +
          `justification:\n  - ${offenders.join('\n  - ')}`,
      )
    }

    expect(offenders).toEqual([])
  })

  it('PUBLIC_ROUTES has no stale entries', () => {
    const stale: string[] = []
    for (const rel of PUBLIC_ROUTES) {
      const abs = path.join(API_DIR, rel)
      let exists = true
      try {
        statSync(abs)
      } catch {
        exists = false
      }
      if (!exists) {
        stale.push(rel)
      }
    }
    expect(stale, `Remove non-existent PUBLIC_ROUTES entries: ${stale.join(', ')}`).toEqual([])
  })
})
