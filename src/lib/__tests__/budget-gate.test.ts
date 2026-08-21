import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Pre-flight budget gate for AI calls.
 *
 * Spend used to be recorded only after a call had happened, so a configured
 * budget could be passed with nothing stopping it. `wouldExceedBudget` decides
 * beforehand, and has two properties that are easy to break and expensive to
 * get wrong:
 *
 *  1. it must never write — it runs on requests that may still fail, and the
 *     obvious implementation (reusing `getBudget`) upserts a default row;
 *  2. a missing budget row must mean "no cap". That same default row carries
 *     $100/month and $10/day limits, so creating it on a read path would
 *     silently start throttling the unmetered internal deployment.
 */

const USER = '00000000-0000-4000-8000-000000000001'
const BRAND = '00000000-0000-4000-8000-0000000000b1'

/** The row `ai_budgets` returns for this test, or null for "not configured". */
let budgetRow: Record<string, unknown> | null = null

/** Every write the code under test attempts, so the read-only claim is testable. */
let writes: string[] = []

function buildChain() {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    single: async () => ({ data: budgetRow, error: budgetRow ? null : { code: 'PGRST116' } }),
    maybeSingle: async () => ({ data: budgetRow, error: null }),
    insert: () => {
      writes.push('insert')
      return chain
    },
    update: () => {
      writes.push('update')
      return chain
    },
    upsert: () => {
      writes.push('upsert')
      return chain
    },
    delete: () => {
      writes.push('delete')
      return chain
    },
  }
  return chain
}

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(() => ({ from: vi.fn(() => buildChain()) })),
}))

import { BudgetManager } from '@/lib/cost-monitor/budget-manager'

beforeEach(() => {
  vi.clearAllMocks()
  writes = []
  budgetRow = null
})

describe('wouldExceedBudget', () => {
  it('allows the call when no budget is configured', async () => {
    const verdict = await new BudgetManager().wouldExceedBudget(USER, BRAND, 5)
    expect(verdict.allowed).toBe(true)
  })

  it('writes nothing when no budget is configured', async () => {
    // Reusing getBudget here would upsert a default budget — a write on a read
    // path, and one that would impose $10/day on an unmetered deployment.
    await new BudgetManager().wouldExceedBudget(USER, BRAND, 5)
    expect(writes).toEqual([])
  })

  it('allows a call that stays inside the monthly limit', async () => {
    budgetRow = { monthlyLimitUsd: 100, currentMonthSpend: 10, dailyLimitUsd: null }
    const verdict = await new BudgetManager().wouldExceedBudget(USER, BRAND, 5)
    expect(verdict.allowed).toBe(true)
    expect(writes).toEqual([])
  })

  it('refuses a call that would cross the monthly limit', async () => {
    budgetRow = { monthlyLimitUsd: 100, currentMonthSpend: 99, dailyLimitUsd: null }
    const verdict = await new BudgetManager().wouldExceedBudget(USER, BRAND, 5)
    expect(verdict.allowed).toBe(false)
    expect(verdict.reason).toBe('monthly_limit')
    expect(verdict.limitUsd).toBe(100)
  })

  it('refuses a call that would cross the daily limit even when the month is fine', async () => {
    budgetRow = {
      monthlyLimitUsd: 100,
      currentMonthSpend: 1,
      dailyLimitUsd: 10,
      currentDaySpend: 9.5,
    }
    const verdict = await new BudgetManager().wouldExceedBudget(USER, BRAND, 5)
    expect(verdict.allowed).toBe(false)
    expect(verdict.reason).toBe('daily_limit')
  })

  it('treats a zero monthly limit as no cap rather than a total block', async () => {
    budgetRow = { monthlyLimitUsd: 0, currentMonthSpend: 500, dailyLimitUsd: null }
    const verdict = await new BudgetManager().wouldExceedBudget(USER, BRAND, 5)
    expect(verdict.allowed).toBe(true)
  })
})
