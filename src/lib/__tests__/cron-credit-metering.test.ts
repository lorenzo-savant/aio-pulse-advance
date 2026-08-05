import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type * as MonitoringModule from '../services/monitoring'

/**
 * Scheduled monitoring must go through the credit ledger.
 *
 * The manual path (`/api/monitoring`) calls `consumeCreditsForQuery` before it
 * runs any engine, and returns 402 when the caller cannot pay. The cron path
 * ran the same paid LLM work and never called it at all — `consumeCreditsForQuery`
 * had exactly two call sites, `/api/credits/use` and the manual path, so every
 * scheduled run bought engine calls that no ledger recorded.
 *
 * The owner was never in doubt: `prompt.user_id` is already threaded through
 * `runMonitoringCheck` in the same loop. This was an omission, not a policy.
 *
 * Behaviour agreed: charge `prompt.user_id`, and on refusal skip that prompt and
 * carry on with the others — one tenant being out of credit must never stop the
 * run for everyone else.
 */

vi.mock('@/lib/supabase', () => ({ createServerClient: vi.fn(() => null) }))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/services/monitoring', async (importOriginal) => {
  const actual = await importOriginal<typeof MonitoringModule>()
  return { ...actual, runMonitoringCheck: vi.fn() }
})

vi.mock('@/lib/services/credits', () => ({
  consumeCreditsForQuery: vi.fn(),
  CreditServiceError: class CreditServiceError extends Error {},
}))

vi.mock('@/lib/services/citation-snapshots', () => ({ calculateCitationSnapshots: vi.fn() }))

// ─── Supabase double ────────────────────────────────────────────────────────
// Only the prompt-selection read matters here: when the credit gate refuses,
// the loop must `continue` before touching anything else, so any other table
// access is itself a failure signal.

const CHAIN_METHODS = [
  'select',
  'eq',
  'or',
  'in',
  'not',
  'gt',
  'lte',
  'order',
  'limit',
  'insert',
  'update',
  'upsert',
  'single',
  'maybeSingle',
]

function makeDb(prompts: unknown[]) {
  const touched: string[] = []

  const thenable = (value: unknown) => {
    const chain: Record<string, unknown> = {}
    for (const m of CHAIN_METHODS) chain[m] = () => chain
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(value).then(resolve)
    return chain
  }

  return {
    db: {
      from: (table: string) => {
        touched.push(table)
        if (table === 'prompts') return thenable({ data: prompts, error: null })
        // A saved row, so the happy path downstream of the gate behaves.
        if (table === 'monitoring_results') {
          return thenable({ data: { id: 'result-1', engine: 'chatgpt' }, error: null })
        }
        return thenable({ data: [], error: null })
      },
    },
    touched,
  }
}

/** Minimal shape the route destructures off a monitoring result. */
const engineResult = (engine: string) => ({
  engine,
  response_text: 'a response',
  competitor_mentions: [],
  hallucination_flags: [],
  sentiment_aspects: [],
  visibility_score: 50,
})

const BRAND = { id: 'brand-1', name: 'Relovie', is_active: true }
const PROMPT = {
  id: 'prompt-1',
  user_id: 'owner-1',
  text: 'who sells sustainable trainers',
  engines: ['chatgpt', 'gemini'],
  brand: BRAND,
}

describe('cron monitoring — credit metering', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    // resetModules re-imports the route, but the vi.fn()s from the vi.mock
    // factories are shared across tests — without this, call counts accumulate.
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    process.env.CRON_SECRET_TOKEN = 'valid-secret'
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  const request = () =>
    new NextRequest('http://localhost/api/cron/monitoring', {
      method: 'POST',
      headers: { authorization: 'Bearer valid-secret' },
    })

  it('charges the prompt owner and runs no engine when credits are refused', async () => {
    const { createServerClient } = await import('@/lib/supabase')
    const { db } = makeDb([PROMPT])
    vi.mocked(createServerClient).mockReturnValue(db as never)

    const { consumeCreditsForQuery } = await import('@/lib/services/credits')
    vi.mocked(consumeCreditsForQuery).mockResolvedValue({
      allowed: false,
      cost: 8,
      type: 'paid',
      message: 'Insufficient credits',
    } as never)

    const { runMonitoringCheck } = await import('@/lib/services/monitoring')

    const { POST } = await import('@/app/api/cron/monitoring/route')
    const res = await POST(request())

    // The owner is charged, not some ambient/service identity.
    expect(consumeCreditsForQuery).toHaveBeenCalledWith(
      'owner-1',
      expect.objectContaining({ brandId: 'brand-1', queryId: 'prompt-1' }),
    )

    // Refusal must stop the paid work — this is the whole point of the gate.
    expect(runMonitoringCheck).not.toHaveBeenCalled()

    // One tenant being out of credit is not a failed cron.
    expect(res.status).toBe(200)
  })

  it('a refused tenant does not stop the next tenant from running', async () => {
    // The refusal path is a `continue`, not a `return`. Under a per-run prompt
    // cap, letting one unpaid tenant abort the loop would starve everyone
    // behind them in the same arbitrary order the selection query already has.
    const OTHER = {
      id: 'prompt-2',
      user_id: 'owner-2',
      text: 'best running shoes',
      engines: ['chatgpt'],
      brand: { id: 'brand-2', name: 'Other', is_active: true },
    }

    const { createServerClient } = await import('@/lib/supabase')
    const { db } = makeDb([PROMPT, OTHER])
    vi.mocked(createServerClient).mockReturnValue(db as never)

    const { consumeCreditsForQuery } = await import('@/lib/services/credits')
    vi.mocked(consumeCreditsForQuery).mockImplementation(
      async (userId: string) =>
        (userId === 'owner-1'
          ? { allowed: false, cost: 8, type: 'paid', message: 'Insufficient credits' }
          : { allowed: true, cost: 4, type: 'paid', message: 'ok' }) as never,
    )

    const { runMonitoringCheck } = await import('@/lib/services/monitoring')
    vi.mocked(runMonitoringCheck).mockResolvedValue(engineResult('chatgpt') as never)

    const { POST } = await import('@/app/api/cron/monitoring/route')
    const res = await POST(request())

    expect(res.status).toBe(200)

    // Both owners were assessed...
    expect(consumeCreditsForQuery).toHaveBeenCalledTimes(2)

    // ...but only the tenant who could pay had engines run, and exactly once
    // (prompt-2 declares a single engine).
    expect(runMonitoringCheck).toHaveBeenCalledTimes(1)
    const [promptArg] = vi.mocked(runMonitoringCheck).mock.calls[0]!
    expect((promptArg as { id: string }).id).toBe('prompt-2')
  })
})
