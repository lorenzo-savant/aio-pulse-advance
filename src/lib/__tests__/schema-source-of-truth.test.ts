import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

/**
 * `supabase/migrations/` must be able to rebuild every relation the app talks to.
 *
 * Why this exists: `team_members.status` carried a CHECK constraint every writer
 * violated, and it hid for months because nothing tied the code's assumptions
 * back to the declared schema. `team-membership-status.test.ts` closes that for
 * one column on one table. This closes the layer underneath it — when a table
 * has no CREATE in the migration repo, no test, no review and no reader can know
 * what constraints it carries, so that class of bug is free to recur invisibly.
 *
 * It also guards a second failure mode: a migration repo that cannot rebuild
 * production makes the DR runbook a claim that is not true.
 *
 * This is a RATCHET, not a clean bill of health. The seven relations below are
 * a real, measured debt — see KNOWN_UNDECLARED. The test's job is to stop an
 * eighth appearing, and to force the list down as each one is repaired.
 */

const ROOT = process.cwd()
const MIGRATIONS = join(ROOT, 'supabase', 'migrations')

/**
 * Relations the migration path cannot create.
 *
 * The list started at seven. Five were declared by
 * `20260805120000_backfill_missing_create_table.sql` — organizations,
 * workspaces, their two membership tables and audit_logs — so the
 * multi-tenant layer and the audit trail can be rebuilt.
 *
 * The last two are now empty for a different reason: `clients` and
 * `sentiment_history` DO NOT EXIST in production. Re-checked read-only on
 * 2026-08-05 and PostgREST answers "Could not find the table" for both. The
 * 2026-08-04 note above them said all seven existed; that was true of the
 * five, and wrong about these two. They were carried as debt to be repaid by
 * writing DDL, when the correct entry was that there is nothing to declare.
 *
 * These two stay listed, but they are NOT waiting for DDL — writing it would
 * create tables nothing has used for months. They are waiting for a decision
 * about the features that query them:
 *
 *   clients            src/lib/aeo-bridge.ts looks a client up by domain and
 *                      always answers "Client not found", so the daily
 *                      /api/cron/aeo-bridge run cannot do anything.
 *   sentiment_history  src/app/api/reports/pdf/route.ts already carries a
 *                      "SCHEMA DRIFT (TODO)" note; the PDF ships without its
 *                      sentiment history every time.
 *
 * Neither crashes — both handle the error — which is why this went unnoticed.
 * Either the tables come back or the code that reads them goes. Declaring them
 * to make this list shorter would be the worst of the three options.
 *
 * The cause of the original debt, for the record: the project moved
 * Prisma → Supabase and `supabase/migrations/` was re-baselined at
 * `20260412000100_fix_schema_types.sql` without carrying the earlier DDL
 * across. It is still stranded in `prisma/migrations/` and
 * `supabase/archive/pre-bootstrap/`, which are not the migration path.
 */
const KNOWN_UNDECLARED = ['clients', 'sentiment_history'] as const

/** Every relation the migration repo can create from scratch. */
function declaredRelations(): Set<string> {
  const found = new Set<string>()
  const re =
    /create\s+(?:or\s+replace\s+)?(?:materialized\s+)?(?:table|view)\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi

  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8')
    for (const m of sql.matchAll(re)) {
      const name = m[1]
      if (name) found.add(name.toLowerCase())
    }
  }
  return found
}

/** Every relation the application actually reads or writes via PostgREST. */
function referencedRelations(): Map<string, string[]> {
  const uses = new Map<string, string[]>()
  const re = /\.from\(\s*'([a-z0-9_]+)'\s*\)/g

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      // Test files reach tables through mocks, and a mock proves nothing about
      // the schema — so they are not evidence of a real dependency.
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') walk(join(dir, entry.name))
        continue
      }
      if (!/\.tsx?$/.test(entry.name)) continue

      const path = join(dir, entry.name)
      for (const m of readFileSync(path, 'utf8').matchAll(re)) {
        const table = m[1]
        if (!table) continue
        const rel = path.slice(ROOT.length + 1).replace(/\\/g, '/')
        const list = uses.get(table) ?? []
        if (!list.includes(rel)) list.push(rel)
        uses.set(table, list)
      }
    }
  }

  walk(join(ROOT, 'src'))
  return uses
}

describe('supabase/migrations is the schema source of truth', () => {
  it('declares every relation the application talks to, bar the known debt', () => {
    const declared = declaredRelations()
    const referenced = referencedRelations()

    const known = new Set<string>(KNOWN_UNDECLARED)
    const undeclared = [...referenced.keys()].filter((t) => !declared.has(t)).sort()
    const fresh = undeclared.filter((t) => !known.has(t))

    // Name the callers, so a failure points at the work rather than just the gap.
    const detail = fresh
      .map((t) => {
        const callers = referenced.get(t) ?? []
        return `  ${t}\n${callers.map((f) => `    ← ${f}`).join('\n')}`
      })
      .join('\n')

    expect(
      fresh,
      `New relations are read or written by src/ but no migration creates them, ` +
        `so the migration repo cannot rebuild them and nothing declares their ` +
        `constraints:\n${detail}\n` +
        `Add a forward-only migration declaring each one. Do not add them to ` +
        `KNOWN_UNDECLARED — that list is a record of pre-existing debt and is ` +
        `meant to shrink.\n`,
    ).toEqual([])
  })

  it('does not carry debt that has already been repaired', () => {
    const declared = declaredRelations()
    const repaired = KNOWN_UNDECLARED.filter((t) => declared.has(t))

    expect(
      repaired,
      `These relations are listed in KNOWN_UNDECLARED but a migration now ` +
        `declares them: ${repaired.join(', ')}. Remove them from the list so the ` +
        `ratchet tightens and cannot silently loosen again.\n`,
    ).toEqual([])
  })
})
