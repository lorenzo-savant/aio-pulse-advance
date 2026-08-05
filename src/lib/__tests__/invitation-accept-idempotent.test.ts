import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Accepting an invitation you have already accepted is success, not failure.
 *
 * The reported symptom: open the invite link, choose "I already have an
 * account", sign in, and the page answers **"Unable to Accept · Invitation is
 * no longer valid"** — while the membership row exists and the brand is
 * visible. The acceptance had worked; only the screen disagreed.
 *
 * The cause is that two paths accept invitations and they race by design.
 * Signing in fires /api/invitations/claim, which matches pending invitations by
 * verified email, flips them to `accepted` and writes the membership. The
 * accept page then posts its token to /api/invitations/accept, which found the
 * invitation no longer `pending` and refused. Measured in production: the
 * membership row was written 162ms after the invitation flipped — by the claim
 * route, before the accept route ever ran.
 *
 * These tests hold the three outcomes apart, because the difference between
 * them is the whole bug: already a member → yes; consumed by someone else →
 * no; wrong account → no, and say so without leaking whose it was.
 */

interface Row {
  [k: string]: unknown
}
let tables: Record<string, Row[]> = {}
let currentUser = 'user-invitee'
let currentEmail = 'invitee@example.com'

function chain(table: string) {
  const filters: Array<(r: Row) => boolean> = []
  let updated: Row | null = null

  const api: Record<string, unknown> = {
    select: () => api,
    eq: (col: string, val: unknown) => {
      filters.push((r) => String(r[col]) === String(val))
      return api
    },
    update: (patch: Row) => {
      updated = patch
      return api
    },
    insert: (row: Row) => {
      tables[table] = [...(tables[table] ?? []), row]
      return api
    },
    single: async () => resolve(),
    maybeSingle: async () => {
      const r = await resolve()
      return { data: r.data, error: null }
    },
    then: (res: (v: unknown) => unknown) => Promise.resolve(resolve()).then(res),
  }

  async function resolve() {
    const matched = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)))
    if (updated) {
      // Mirrors PostgREST: an UPDATE ... .select() returns only the rows the
      // filters actually matched, which is what makes the atomic claim atomic.
      for (const r of matched) Object.assign(r, updated)
      return matched.length ? { data: matched[0], error: null } : { data: null, error: null }
    }
    return matched.length ? { data: matched[0], error: null } : { data: null, error: null }
  }

  return api
}

vi.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    from: (t: string) => chain(t),
    auth: { admin: { getUserById: async () => ({ data: { user: { email: currentEmail } } }) } },
  }),
  getCurrentUserId: async () => currentUser,
  AuthError: class AuthError extends Error {},
}))
vi.mock('@/lib/ratelimit', () => ({
  checkRateLimit: async () => ({ success: true, remaining: 9, resetAt: Date.now() + 1000 }),
  getClientIp: () => '127.0.0.1',
}))

import { POST } from '@/app/api/invitations/accept/route'

const BRAND = 'brand-relovie'
// The route requires a hex token of the real length — see the schema in
// accept/route.ts. A placeholder fails validation before any logic runs.
const TOKEN = 'a'.repeat(64)

function post() {
  return POST(
    new Request('http://x/api/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token: TOKEN }),
      headers: { 'content-type': 'application/json' },
    }) as never,
  )
}

beforeEach(() => {
  currentUser = 'user-invitee'
  currentEmail = 'invitee@example.com'
  tables = {
    brand_invitations: [
      {
        id: 'inv-1',
        token: TOKEN,
        brand_id: BRAND,
        email: 'invitee@example.com',
        role: 'editor',
        status: 'pending',
        invited_by: 'user-owner',
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      },
    ],
    brands: [{ id: BRAND, name: 'Relovie', user_id: 'user-owner' }],
    team_members: [],
  }
})

describe('POST /api/invitations/accept — idempotent', () => {
  it('accepts a pending invitation and creates the membership', async () => {
    const res = await post()
    expect(res.status).toBe(200)
    expect(tables.team_members).toHaveLength(1)
  })

  it('answers YES when sign-in already accepted it — the reported bug', async () => {
    // Exactly the production state: the claim route flipped the invitation and
    // wrote the membership moments earlier.
    tables.brand_invitations![0]!.status = 'accepted'
    tables.team_members = [{ brand_id: BRAND, user_id: 'user-invitee', role: 'editor' }]

    const res = await post()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.alreadyMember).toBe(true)
    expect(body.message).toMatch(/Relovie/)
  })

  it('does not create a second membership row for the same person', async () => {
    tables.brand_invitations![0]!.status = 'accepted'
    tables.team_members = [{ brand_id: BRAND, user_id: 'user-invitee', role: 'editor' }]

    await post()
    expect(tables.team_members).toHaveLength(1)
  })

  it('still refuses a token consumed by somebody else', async () => {
    // Same email on the invitation, but this caller never became a member — so
    // the token really was used by another account. Idempotence must not become
    // a way to inherit someone else's invitation.
    tables.brand_invitations![0]!.status = 'accepted'
    tables.team_members = [{ brand_id: BRAND, user_id: 'someone-else', role: 'editor' }]

    const res = await post()
    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/no longer valid/i)
  })

  it('still refuses a declined invitation', async () => {
    tables.brand_invitations![0]!.status = 'declined'
    const res = await post()
    expect(res.status).toBe(400)
  })

  it('still refuses an expired invitation', async () => {
    tables.brand_invitations![0]!.expires_at = new Date(Date.now() - 1000).toISOString()
    const res = await post()
    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/expired/i)
  })

  it('refuses the wrong account, and checks that BEFORE the status', async () => {
    // The email check moved ahead of the status check: answering "no longer
    // valid" to an unmatched token tells whoever holds it that it was real and
    // has been used. Consumed or not, the answer to a stranger is the same.
    currentEmail = 'someone@else.com'
    tables.brand_invitations![0]!.status = 'accepted'

    const res = await post()
    const body = await res.json()
    expect(res.status).toBe(403)
    // The route names this field `error`, not `code` — see its err() helper.
    expect(body.error).toBe('EMAIL_MISMATCH')
    expect(body.message).not.toMatch(/no longer valid/i)
  })
})
