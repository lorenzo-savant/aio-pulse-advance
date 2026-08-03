import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { INACTIVE_MEMBER_STATUSES } from '../authorize'

/**
 * Regression guard for the vocabulary split on `team_members.status`.
 *
 * The bug this locks down: every access check allowlisted `status='accepted'`,
 * but the only writer of the table inserts `'active'`. The filter therefore
 * matched nothing, and team collaboration silently did nothing — an invited
 * colleague accepted the invitation, a membership row was created, and they
 * still saw none of the brand they had been invited to. No test caught it
 * because every test fixture also used `'accepted'`, so the mocks agreed with
 * the broken production filter.
 *
 * These are static assertions over the source: they cannot be satisfied by a
 * mock that shares the same wrong assumption.
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
  it('the accept route still writes the status these checks are built around', () => {
    const accept = read('app/api/invitations/accept/route.ts')
    // If this ever changes, every filter below must be revisited together.
    expect(accept).toMatch(/status:\s*'active'/)
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
