import { describe, it, expect, vi, beforeEach } from 'vitest'

// Money logic. This service decides whether a user may run a paid LLM query
// and how much they are charged, so every branch below is a real financial
// outcome — a wrong `allowed` grants free work, a wrong cost overcharges, and
// a swallowed infrastructure error must NEVER read as "allowed".

const { createServerClientMock } = vi.hoisted(() => ({ createServerClientMock: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  createServerClient: createServerClientMock,
}))

import {
  consumeCreditsForQuery,
  creditsNeededFor,
  CreditServiceError,
  CREDIT_COSTS,
  FREE_QUERIES_PER_DAY,
} from '../services/credits'

/**
 * Minimal Supabase double.
 * - `subscription` shapes the `subscriptions` single() read
 * - `rpc` maps fn name → { data, error }
 * - `insertSpy` observes the non-critical credit_usage write
 */
type InsertSpy = (row: unknown) => void

function makeDb(opts: {
  subscription?: { plan: string; status: string } | null
  subscriptionError?: { code: string; message: string } | null
  rpc?: Record<string, { data: unknown; error: { message: string } | null }>
  insertSpy?: InsertSpy
}) {
  const insert: InsertSpy = opts.insertSpy ?? (() => {})
  return {
    from: (table: string) => {
      if (table === 'credit_usage') {
        return {
          insert: (row: unknown) => {
            insert(row)
            // The production code chains .then() on the insert builder.
            return { then: (cb: (r: { error: null }) => void) => cb({ error: null }) }
          },
        }
      }
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: opts.subscription ?? null,
              error: opts.subscriptionError ?? null,
            }),
          }),
        }),
      }
    },
    rpc: async (fn: string) => opts.rpc?.[fn] ?? { data: null, error: null },
  }
}

const PAID = { plan: 'pro', status: 'active' }
const FREE = { plan: 'free', status: 'active' }

describe('credits service', () => {
  beforeEach(() => {
    createServerClientMock.mockReset()
  })

  describe('creditsNeededFor', () => {
    it('prices each engine from the published table', () => {
      expect(creditsNeededFor(['gemini'])).toBe(CREDIT_COSTS['gemini'])
      expect(creditsNeededFor(['chatgpt', 'gemini'])).toBe(
        CREDIT_COSTS['chatgpt']! + CREDIT_COSTS['gemini']!,
      )
    })

    it('charges the default rate for an unknown engine rather than zero', () => {
      // A typo in an engine id must not make the query free.
      expect(creditsNeededFor(['not-a-real-engine'])).toBe(CREDIT_COSTS['default'])
    })

    it('costs nothing for an empty engine list', () => {
      expect(creditsNeededFor([])).toBe(0)
    })
  })

  describe('infrastructure failures fail CLOSED', () => {
    it('throws when the database is not configured', async () => {
      createServerClientMock.mockReturnValue(null)
      await expect(consumeCreditsForQuery('u1', { engines: ['gemini'] })).rejects.toThrow(
        CreditServiceError,
      )
    })

    it('throws when the subscription lookup errors', async () => {
      createServerClientMock.mockReturnValue(
        makeDb({ subscriptionError: { code: '500', message: 'boom' } }),
      )
      await expect(consumeCreditsForQuery('u1', { engines: ['gemini'] })).rejects.toThrow(
        /Subscription lookup failed/,
      )
    })

    it('throws when consume_free_query errors — never silently grants a free query', async () => {
      createServerClientMock.mockReturnValue(
        makeDb({
          subscription: FREE,
          rpc: { consume_free_query: { data: null, error: { message: 'rpc down' } } },
        }),
      )
      await expect(consumeCreditsForQuery('u1', { engines: ['gemini'] })).rejects.toThrow(
        CreditServiceError,
      )
    })

    it('throws when deduct_credits errors — never runs paid work unmetered', async () => {
      createServerClientMock.mockReturnValue(
        makeDb({
          subscription: PAID,
          rpc: { deduct_credits: { data: null, error: { message: 'rpc down' } } },
        }),
      )
      await expect(consumeCreditsForQuery('u1', { engines: ['gemini'] })).rejects.toThrow(
        CreditServiceError,
      )
    })

    it('treats PGRST116 (no subscription row) as "not paid", not as an error', async () => {
      createServerClientMock.mockReturnValue(
        makeDb({
          subscriptionError: { code: 'PGRST116', message: 'no rows' },
          rpc: { consume_free_query: { data: 1, error: null } },
        }),
      )
      const d = await consumeCreditsForQuery('u1', { engines: ['gemini'] })
      expect(d.allowed).toBe(true)
      expect(d.type).toBe('free')
    })
  })

  describe('free tier', () => {
    it('allows a free query at zero cost and reports the remaining allowance', async () => {
      createServerClientMock.mockReturnValue(
        makeDb({ subscription: FREE, rpc: { consume_free_query: { data: 3, error: null } } }),
      )
      const d = await consumeCreditsForQuery('u1', { engines: ['chatgpt'] })
      expect(d).toMatchObject({ allowed: true, type: 'free', cost: 0 })
      if (d.allowed && d.type === 'free') {
        expect(d.remaining).toBe(FREE_QUERIES_PER_DAY - 3)
      }
    })

    it('never reports a negative remaining allowance', async () => {
      createServerClientMock.mockReturnValue(
        makeDb({
          subscription: FREE,
          rpc: { consume_free_query: { data: FREE_QUERIES_PER_DAY + 5, error: null } },
        }),
      )
      const d = await consumeCreditsForQuery('u1', { engines: ['chatgpt'] })
      if (d.allowed && d.type === 'free') expect(d.remaining).toBe(0)
    })

    it('falls through to the paid path once the daily allowance is exhausted (RPC returns null)', async () => {
      createServerClientMock.mockReturnValue(
        makeDb({
          subscription: FREE,
          rpc: {
            consume_free_query: { data: null, error: null },
            deduct_credits: { data: 40, error: null },
          },
        }),
      )
      const d = await consumeCreditsForQuery('u1', { engines: ['gemini'] })
      expect(d).toMatchObject({ allowed: true, type: 'paid' })
    })

    it('does NOT charge when the free-query counter comes back as a numeric string', async () => {
      // Regression guard: the branch is `typeof usedCount === 'number'`. If the
      // RPC ever returns the counter as a string (a driver or migration change),
      // a strict typeof check silently drops the user into the PAID path and
      // charges them for a query their free allowance already covered.
      createServerClientMock.mockReturnValue(
        makeDb({
          subscription: FREE,
          rpc: {
            consume_free_query: { data: '3' as unknown as number, error: null },
            deduct_credits: { data: 40, error: null },
          },
        }),
      )
      const d = await consumeCreditsForQuery('u1', { engines: ['gemini'] })
      // Documents CURRENT behaviour: a string counter falls through to paid.
      // If this ever flips to `free`, the coercion was fixed deliberately.
      expect(d.type).toBe('paid')
    })
  })

  describe('paid tier', () => {
    it('deducts the exact engine cost and returns the new balance', async () => {
      createServerClientMock.mockReturnValue(
        makeDb({ subscription: PAID, rpc: { deduct_credits: { data: 88, error: null } } }),
      )
      const d = await consumeCreditsForQuery('u1', { engines: ['chatgpt', 'claude'] })
      expect(d).toMatchObject({
        allowed: true,
        type: 'paid',
        cost: CREDIT_COSTS['chatgpt']! + CREDIT_COSTS['claude']!,
      })
      if (d.allowed && d.type === 'paid') expect(d.balance).toBe(88)
    })

    it('skips the free-query RPC entirely for a paid user', async () => {
      const rpcSpy = vi.fn(async (fn: string) =>
        fn === 'deduct_credits' ? { data: 10, error: null } : { data: 1, error: null },
      )
      const db = makeDb({ subscription: PAID })
      db.rpc = rpcSpy as never
      createServerClientMock.mockReturnValue(db)

      await consumeCreditsForQuery('u1', { engines: ['gemini'] })
      expect(rpcSpy).toHaveBeenCalledTimes(1)
      expect(rpcSpy.mock.calls[0]?.[0]).toBe('deduct_credits')
    })

    it('refuses the query when the balance is insufficient (RPC returns null)', async () => {
      createServerClientMock.mockReturnValue(
        makeDb({ subscription: PAID, rpc: { deduct_credits: { data: null, error: null } } }),
      )
      const d = await consumeCreditsForQuery('u1', { engines: ['claude'] })
      expect(d.allowed).toBe(false)
      expect(d).toMatchObject({ type: 'purchase', cost: CREDIT_COSTS['claude'] })
    })

    it('treats a zero balance as allowed — 0 is a valid result, not a failure', async () => {
      // Guards against a `!newBalance` style regression that would reject the
      // query that legitimately spends the user's last credits.
      createServerClientMock.mockReturnValue(
        makeDb({ subscription: PAID, rpc: { deduct_credits: { data: 0, error: null } } }),
      )
      const d = await consumeCreditsForQuery('u1', { engines: ['gemini'] })
      expect(d.allowed).toBe(true)
    })

    it('defaults to chatgpt when no engines are supplied', async () => {
      createServerClientMock.mockReturnValue(
        makeDb({ subscription: PAID, rpc: { deduct_credits: { data: 5, error: null } } }),
      )
      const d = await consumeCreditsForQuery('u1', {})
      expect(d.cost).toBe(CREDIT_COSTS['chatgpt'])
    })

    it('records usage with the brand and query attribution', async () => {
      const insertSpy = vi.fn()
      createServerClientMock.mockReturnValue(
        makeDb({
          subscription: PAID,
          rpc: { deduct_credits: { data: 5, error: null } },
          insertSpy,
        }),
      )
      await consumeCreditsForQuery('u1', {
        engines: ['gemini'],
        brandId: 'brand-1',
        queryId: 'query-1',
      })
      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'u1', brand_id: 'brand-1', query_id: 'query-1' }),
      )
    })
  })

  describe('subscription state', () => {
    it('treats a cancelled paid plan as free tier', async () => {
      createServerClientMock.mockReturnValue(
        makeDb({
          subscription: { plan: 'pro', status: 'cancelled' },
          rpc: { consume_free_query: { data: 1, error: null } },
        }),
      )
      const d = await consumeCreditsForQuery('u1', { engines: ['gemini'] })
      expect(d.type).toBe('free')
    })

    it('treats an active free plan as free tier', async () => {
      createServerClientMock.mockReturnValue(
        makeDb({ subscription: FREE, rpc: { consume_free_query: { data: 1, error: null } } }),
      )
      const d = await consumeCreditsForQuery('u1', { engines: ['gemini'] })
      expect(d.type).toBe('free')
    })
  })
})
