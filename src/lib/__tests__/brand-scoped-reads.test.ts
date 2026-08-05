import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

/**
 * Regression guard: brand data is read by BRAND, never by author.
 *
 * The bug this exists to prevent was invisible from the access layer, because
 * the access layer was right. `verifyBrandAccess` honoured team membership, so
 * an invited collaborator opened Relovie and saw the brand — and then every
 * query for its CONTENTS added `.eq('user_id', <the viewer>)`, and the brand
 * came up empty. 13 prompts and 31 monitoring results were sitting in the
 * table, all stamped with the owner's id. Measured on production, 2026-08-04.
 *
 * Rows keep their `user_id` as provenance — who wrote this prompt, who ran this
 * scan — and that is worth having. It is just not an access rule. The tables
 * below all hang off a brand, so the caller's own id has no business filtering
 * them: scope with `.in('brand_id', await getAccessibleBrandIds(db, userId))`,
 * or gate with `requireBrandRole` and filter on `brand_id` alone.
 *
 * A static assertion over the source, so a mock that shares the wrong
 * assumption cannot satisfy it.
 */

const API_DIR = join(process.cwd(), 'src', 'app', 'api')

/** Tables whose rows belong to a brand rather than to a person. */
const BRAND_OWNED_TABLES = [
  'prompts',
  'monitoring_results',
  'alert_rules',
  'alert_events',
  'brand_health_scores',
  'competitor_analyses',
  'weekly_reviews',
  'recommendation_history',
  'llms_txt_versions',
  'aeo_snippets',
  'report_schedules',
  'work_orders',
]

/**
 * Deliberate exceptions, each with a reason. `scan_history` and
 * `workflow_executions` are absent from the list above precisely because a row
 * in them may have NO brand (a scan pasted before any brand exists), so they
 * legitimately fall back to the author.
 */
const ALLOWED: Record<string, string> = {
  // The v1 write endpoints are owner-only by design: a collaborator works
  // inside a brand, they do not rename or delete it.
  'v1/brands/[id]/route.ts': 'owner-only writes',
  'brands/[id]/route.ts': 'owner-only writes',
  // Personal resources, not brand data.
  'credits/route.ts': 'personal balance',
  'keys/route.ts': 'personal API keys',
  'audit/technical/route.ts': 'per-user cache of a URL audit, has no brand_id',
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (entry.endsWith('.ts')) out.push(full)
  }
  return out
}

const routeFiles = walk(API_DIR)

describe('brand data is scoped by brand, not by author', () => {
  it('finds the API routes to check', () => {
    // Guard the guard: a broken walk would make every assertion below vacuous.
    expect(routeFiles.length).toBeGreaterThan(30)
  })

  it.each(BRAND_OWNED_TABLES)('no route filters %s by the caller’s own user_id', (table) => {
    const offenders: string[] = []

    for (const file of routeFiles) {
      const rel = file.slice(API_DIR.length + 1).replace(/\\/g, '/')
      if (Object.keys(ALLOWED).some((a) => rel.endsWith(a))) continue

      const src = readFileSync(file, 'utf8')
      let from = src.indexOf(`from('${table}')`)
      while (from !== -1) {
        // A query chain ends at the await/statement boundary; 600 chars is
        // comfortably past the longest chain in this codebase.
        const chain = src.slice(from, from + 600)
        const stop = chain.search(/\n\s*\n|\n\s*(const|let|return|if|})\s/)
        const scoped = stop === -1 ? chain : chain.slice(0, stop)

        if (/\.eq\(\s*'user_id',\s*(userId|user\.id|String\(userId\))/.test(scoped)) {
          offenders.push(rel)
        }
        from = src.indexOf(`from('${table}')`, from + 1)
      }
    }

    expect(offenders).toEqual([])
  })

  it('the shared read scope is exported and used', () => {
    // If getAccessibleBrandIds ever loses its callers again, the union it
    // encodes has drifted back into the routes — which is how the two copies
    // fell out of sync in the first place.
    const authorize = readFileSync(join(process.cwd(), 'src/lib/authorize.ts'), 'utf8')
    expect(authorize).toMatch(/export async function getAccessibleBrandIds/)

    const callers = routeFiles.filter((f) =>
      readFileSync(f, 'utf8').includes('getAccessibleBrandIds('),
    )
    expect(callers.length).toBeGreaterThan(5)
  })
})
