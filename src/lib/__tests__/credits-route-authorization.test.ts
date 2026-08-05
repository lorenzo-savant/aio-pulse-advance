import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * `POST /api/credits` must not be a faucet.
 *
 * As shipped, the handler authenticated the caller and then inserted whatever
 * `amount` they asked for into their OWN `credits` row, with `action: 'add'`
 * and no role check anywhere in the file or in middleware. Any authenticated
 * user could POST {"action":"add","amount":1000000} and void the entire credit
 * system — and with it the revenue model.
 *
 * It also bypassed the atomic ledger. `deduct_credits`
 * (supabase/migrations/20260518130000_atomic_credit_deduction.sql:38) exists
 * precisely because a check-then-act read-then-insert allows concurrent
 * requests to double-spend; it takes pg_advisory_xact_lock. This route wrote
 * the same table directly, with no lock and no RPC — a third writer that
 * silently opted out of the fix.
 *
 * Stripe is out of use for now, so granting credits is an INTERNAL operation:
 * allowed for developers (the process is in unlimited mode) or for explicitly
 * named internal accounts (AIO_INTERNAL_USER_IDS). Refused for everyone else,
 * which in a metered production process means everyone.
 */

const { getCurrentUserIdMock, createServerClientMock, getPlatformModeMock, insertSpy, rpcSpy } =
  vi.hoisted(() => ({
    getCurrentUserIdMock: vi.fn(),
    createServerClientMock: vi.fn(),
    getPlatformModeMock: vi.fn(),
    insertSpy: vi.fn(),
    rpcSpy: vi.fn(),
  }))

vi.mock('@/lib/supabase', () => ({
  createServerClient: createServerClientMock,
  getCurrentUserId: getCurrentUserIdMock,
  AuthError: class AuthError extends Error {},
}))

vi.mock('@/lib/ratelimit', () => ({
  checkRateLimit: vi.fn(async () => ({ success: true, resetAt: Date.now() + 60_000 })),
  getClientIp: vi.fn(() => '203.0.113.1'),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/platform-mode', () => ({ getPlatformMode: getPlatformModeMock }))

const USER = 'user-normal-1'
const INTERNAL = 'user-internal-1'

function makeDb() {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'limit']) chain[m] = () => chain
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: [{ amount: 10 }], error: null }).then(resolve)

  return {
    from: () => ({
      ...chain,
      insert: (row: unknown) => {
        insertSpy(row)
        return { then: (cb: (r: { error: null }) => void) => cb({ error: null }) }
      },
    }),
    rpc: (fn: string, args: unknown) => {
      rpcSpy(fn, args)
      return { then: (cb: (r: unknown) => void) => cb({ data: 5, error: null }) }
    },
  }
}

const post = (body: unknown) =>
  new NextRequest('http://localhost/api/credits', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'sb=1' },
    body: JSON.stringify(body),
  })

describe('POST /api/credits — who may grant credits', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    delete process.env['AIO_INTERNAL_USER_IDS']
    createServerClientMock.mockReturnValue(makeDb())
    getPlatformModeMock.mockReturnValue('metered')
    getCurrentUserIdMock.mockResolvedValue(USER)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('refuses a normal user granting themselves credits, and writes nothing', async () => {
    const { POST } = await import('@/app/api/credits/route')
    const res = await POST(post({ action: 'add', amount: 1_000_000 }))

    expect(res.status).toBe(403)
    // The assertion that matters: refusal must mean no ledger row.
    expect(insertSpy).not.toHaveBeenCalled()
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it('allows a named internal account to grant credits', async () => {
    process.env['AIO_INTERNAL_USER_IDS'] = `someone-else,${INTERNAL}`
    getCurrentUserIdMock.mockResolvedValue(INTERNAL)

    const { POST } = await import('@/app/api/credits/route')
    const res = await POST(post({ action: 'add', amount: 50 }))

    expect(res.status).toBe(200)
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: INTERNAL, amount: 50 }),
    )
  })

  it('allows granting in unlimited mode — the development case', async () => {
    getPlatformModeMock.mockReturnValue('unlimited')

    const { POST } = await import('@/app/api/credits/route')
    const res = await POST(post({ action: 'add', amount: 50 }))

    expect(res.status).toBe(200)
    expect(insertSpy).toHaveBeenCalled()
  })

  it('deducts through the locked RPC, never a raw insert', async () => {
    // deduct_credits takes pg_advisory_xact_lock and refuses to overdraw. A
    // direct insert does neither, which is how a third writer reintroduces the
    // double-spend the migration removed.
    const { POST } = await import('@/app/api/credits/route')
    const res = await POST(post({ action: 'deduct', amount: 3 }))

    expect(res.status).toBe(200)
    expect(rpcSpy).toHaveBeenCalledWith(
      'deduct_credits',
      expect.objectContaining({ p_user_id: USER, p_amount: 3 }),
    )
    expect(insertSpy).not.toHaveBeenCalled()
  })
})
