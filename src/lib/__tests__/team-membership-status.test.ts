import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { INACTIVE_MEMBER_STATUSES } from '../authorize'

/**
 * Regression guard for `team_members.status`.
 *
 * The real bug, found by replaying the API's own query chain against the live
 * database: the column is
 *   status text NOT NULL DEFAULT 'pending'
 *     CHECK (status IN ('pending','accepted','declined'))
 * and every writer inserted `'active'`. The CHECK rejected it, so NO membership
 * row was ever created — team_members sat empty across every invitation ever
 * sent. Both routes roll the invitation back to `pending` when the insert
 * fails, so the end state looked exactly like "nothing happened", and the
 * error was stringified into a generic message on the way out.
 *
 * An earlier reading of this blamed the READERS (they filtered on 'accepted',
 * which no row had) and relaxed them to a denylist. That was treating the
 * symptom: with the writer fixed, no row can hold a status outside the CHECK
 * anyway. The denylist is kept because it is tolerant of both vocabularies,
 * but the writer is the thing that had to change.
 *
 * These are static assertions over the source and the migration, so a mock
 * that repeats the same wrong assumption cannot satisfy them.
 */

const SRC = join(process.cwd(), 'src')
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8')

// Every file that gates access on a team_members row.
const ACCESS_CHECK_FILES = [
  'lib/authorize.ts',
  'app/api/brands/route.ts',
  'app/api/team/route.ts',
  'app/api/monitoring/route.ts',
]

describe('team_members.status — access-check consistency', () => {
  // The database is the authority, and it is strict:
  //   status text NOT NULL DEFAULT 'pending'
  //     CHECK (status IN ('pending','accepted','declined'))
  //   — supabase/migrations/20260412000100_fix_schema_types.sql:235
  //
  // Every writer sent 'active', which the CHECK rejects, so EVERY membership
  // insert failed. Both routes roll the invitation back to `pending` on
  // failure, so the end state was indistinguishable from "nothing happened":
  // team_members stayed empty across every invitation ever sent, and the
  // caller saw only a generic message. Months of a dead collaboration feature
  // came down to one word.
  const ALLOWED_MEMBER_STATUSES = ['pending', 'accepted', 'declined']

  const MEMBERSHIP_WRITERS = [
    'app/api/invitations/accept/route.ts',
    'app/api/invitations/claim/route.ts',
  ]

  it.each(MEMBERSHIP_WRITERS)('%s never writes the CHECK-rejected "active"', (file) => {
    const src = read(file)
    const block = src.slice(src.indexOf("from('team_members').insert"))
    expect(block.slice(0, 1400)).not.toMatch(/status:\s*'active'/)
  })

  it.each(MEMBERSHIP_WRITERS)('%s writes a status the CHECK permits', (file) => {
    const src = read(file)
    const block = src.slice(src.indexOf("from('team_members').insert"))
    const m = block.slice(0, 1400).match(/status:\s*'([a-z]+)'/)
    expect(m).not.toBeNull()
    expect(ALLOWED_MEMBER_STATUSES).toContain(m![1])
  })

  it('the migration still declares the vocabulary these writers target', () => {
    // If someone widens the CHECK, this test should be revisited deliberately
    // rather than silently drifting again.
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260412000100_fix_schema_types.sql'),
      'utf8',
    )
    const block = migration.slice(migration.indexOf('CREATE TABLE team_members'))
    expect(block.slice(0, 900)).toMatch(
      /status text NOT NULL DEFAULT 'pending' CHECK \(status IN \('pending', 'accepted', 'declined'\)\)/,
    )
  })

  it('membership insert failures are logged with the DB message, not swallowed', () => {
    // The constraint violation hid for months because the error was
    // stringified into a generic message. Keep the real one.
    for (const file of MEMBERSHIP_WRITERS) {
      const src = read(file)
      expect(src).toMatch(/error:\s*memberError\.message/)
    }
  })

  it.each(ACCESS_CHECK_FILES)(
    '%s never allowlists a single status for team_members access',
    (file) => {
      const src = read(file)
      // `.eq('status', 'accepted')` is the exact shape of the original bug:
      // it can only ever match rows the app does not write.
      expect(src).not.toMatch(/\.eq\(\s*'status',\s*'accepted'\s*\)/)
    },
  )

  it.each(ACCESS_CHECK_FILES)('%s denylists pending and declined', (file) => {
    const src = read(file)
    expect(src).toMatch(/\.not\(\s*'status',\s*'in',/)
  })

  it('the shared denylist excludes exactly the two non-granting states', () => {
    expect(INACTIVE_MEMBER_STATUSES).toContain('pending')
    expect(INACTIVE_MEMBER_STATUSES).toContain('declined')
    // It must NOT exclude the value the writer actually uses, nor the value
    // the TypeScript union declares — both have to keep granting access.
    expect(INACTIVE_MEMBER_STATUSES).not.toContain('active')
    expect(INACTIVE_MEMBER_STATUSES).not.toContain('accepted')
  })

  it('monitoring gates on membership status at all', () => {
    // This check shipped with NO status filter, so a merely-invited user
    // counted as a team member and could spend the owner's credits.
    const src = read('app/api/monitoring/route.ts')
    const block = src.slice(src.indexOf("from('team_members')"))
    expect(block.slice(0, 400)).toMatch(/\.not\(\s*'status',\s*'in',/)
  })
})
