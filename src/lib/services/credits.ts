// PATH: src/lib/services/credits.ts
//
// Credit consumption — single source of truth for "can this user run a
// query, and at what cost?". Used by:
//   - /api/credits/use   (HTTP shell: auth + rate limit + Zod)
//   - /api/monitoring    (direct call — previously did a self-HTTP fetch to
//     /api/credits/use forwarding the caller's cookie/authorization headers,
//     which doubled invocations and derived the target origin from the
//     inbound Host header)

import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

// Loose RPC shape — the generated Database type's rpc<> overloads gate by a
// fixed name union that doesn't include consume_free_query / deduct_credits.
type RpcCapableClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
}

/** Credit cost per query by engine. */
export const CREDIT_COSTS: Record<string, number> = {
  chatgpt: 2,
  gemini: 1,
  perplexity: 3,
  claude: 3,
  default: 2,
}

/** Free queries per day (free tier). */
export const FREE_QUERIES_PER_DAY = 10

/**
 * Unlimited-credits mode — for internal / pre-revenue environments where the
 * quota is noise rather than a control.
 *
 * Enabling it makes every query allowed at zero cost: no free-tier counter is
 * consumed, no balance is deducted, and no DB round-trip is made. That last
 * point is deliberate — an internal environment stays usable even when the
 * credit tables or RPCs are unhealthy.
 *
 * TWO locks, because a stray env var here means unlimited spend on someone
 * else's paid LLM keys:
 *
 *   1. `AIO_UNLIMITED_CREDITS=true` turns it on.
 *   2. In production it ALSO requires
 *      `AIO_UNLIMITED_CREDITS_ALLOW_PRODUCTION=true`. Without that second
 *      acknowledgement the flag is IGNORED and loudly logged, so copying a
 *      staging env file onto prod cannot silently disable billing.
 *
 * Default is off. The state is reported by /api/health so it is never a
 * surprise.
 */
export function isUnlimitedCreditsMode(): boolean {
  if (process.env['AIO_UNLIMITED_CREDITS'] !== 'true') return false

  const isProd = process.env.NODE_ENV === 'production' || process.env['VERCEL_ENV'] === 'production'

  if (isProd && process.env['AIO_UNLIMITED_CREDITS_ALLOW_PRODUCTION'] !== 'true') {
    logger.error(
      'AIO_UNLIMITED_CREDITS is set in a PRODUCTION environment and was IGNORED. ' +
        'Set AIO_UNLIMITED_CREDITS_ALLOW_PRODUCTION=true to acknowledge unmetered spend, ' +
        'or remove AIO_UNLIMITED_CREDITS.',
      { source: 'credits' },
    )
    return false
  }

  return true
}

/** Infrastructure failure (DB unavailable, RPC error). Callers must fail
 *  closed: never run paid LLM work when the gate could not be evaluated. */
export class CreditServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CreditServiceError'
  }
}

export interface ConsumeCreditsInput {
  engines?: string[]
  provider?: string | null
  brandId?: string | null
  queryId?: string | null
}

export type CreditDecision =
  | {
      allowed: true
      cost: number
      type: 'unlimited'
      message: string
    }
  | {
      allowed: true
      cost: number
      type: 'free'
      remaining: number
      message: string
    }
  | {
      allowed: true
      cost: number
      type: 'paid'
      balance: number
      message: string
    }
  | {
      allowed: false
      cost: number
      type: 'purchase'
      message: string
    }

export function creditsNeededFor(engines: string[]): number {
  const defaultCost = CREDIT_COSTS['default'] ?? 2
  return engines.reduce((total, engine) => total + (CREDIT_COSTS[engine] ?? defaultCost), 0)
}

/**
 * Atomically consume credits (or a free-tier daily query) for a run.
 *
 * Free tier goes through consume_free_query (row-locked counter); paid path
 * goes through deduct_credits (atomic balance check + deduction). Throws
 * CreditServiceError on any infrastructure failure.
 */
export async function consumeCreditsForQuery(
  userId: string,
  input: ConsumeCreditsInput,
): Promise<CreditDecision> {
  const engines = input.engines && input.engines.length > 0 ? input.engines : ['chatgpt']

  // Unlimited mode short-circuits BEFORE any DB access, so an internal
  // environment keeps working even if the credit tables or RPCs are broken.
  // Logged every time: unmetered spend must never be silent.
  if (isUnlimitedCreditsMode()) {
    logger.warn('Credit check bypassed — unlimited-credits mode is enabled', {
      source: 'credits',
      engines: engines.join(','),
      brandId: input.brandId ?? null,
    })
    return {
      allowed: true,
      cost: 0,
      type: 'unlimited',
      message: 'Unlimited mode — no credits consumed',
    }
  }

  const db = createServerClient()
  if (!db) throw new CreditServiceError('Database not configured')

  // Check user's subscription status
  const { data: subscription, error: subError } = await db
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .single()

  if (subError && subError.code !== 'PGRST116') {
    throw new CreditServiceError(`Subscription lookup failed: ${subError.message}`)
  }

  const isPaidUser = subscription?.status === 'active' && subscription?.plan !== 'free'
  const creditsNeeded = creditsNeededFor(engines)

  // Free-tier path — atomic: consume_free_query() increments a per-day
  // counter under a row lock, so concurrent requests cannot each pass.
  if (!isPaidUser) {
    const { data: usedCount, error: freeErr } = await (db as unknown as RpcCapableClient).rpc(
      'consume_free_query',
      {
        p_user_id: userId,
        p_limit: FREE_QUERIES_PER_DAY,
      },
    )

    if (freeErr) {
      logger.error('consume_free_query RPC failed', { source: 'credits', err: freeErr.message })
      throw new CreditServiceError('Failed to check credits')
    }

    if (typeof usedCount === 'number') {
      const remaining = Math.max(0, FREE_QUERIES_PER_DAY - usedCount)
      return {
        allowed: true,
        cost: 0,
        type: 'free',
        remaining,
        message: `Free query (${remaining} remaining today)`,
      }
    }
    // usedCount === null → daily free limit reached; fall through to paid path.
  }

  // Atomic balance-check + deduction in a single locked DB operation
  // (deduct_credits): prevents concurrent requests from double-spending.
  const description = `Query with ${engines.join(', ')}`

  const { data: newBalance, error: deductError } = await (db as unknown as RpcCapableClient).rpc(
    'deduct_credits',
    {
      p_user_id: userId,
      p_amount: creditsNeeded,
      p_description: description,
    },
  )

  if (deductError) {
    logger.error('deduct_credits RPC failed', { source: 'credits', err: deductError.message })
    throw new CreditServiceError('Failed to check credits')
  }

  if (newBalance === null || newBalance === undefined) {
    return {
      allowed: false,
      cost: creditsNeeded,
      type: 'purchase',
      message: `Insufficient credits. Need ${creditsNeeded}`,
    }
  }

  // Record usage (non-critical — log errors but don't fail the run)
  await db
    .from('credit_usage')
    .insert({
      user_id: userId,
      query_id: input.queryId || null,
      credits_used: creditsNeeded,
      provider: input.provider || engines[0],
      engine: engines.join(','),
      brand_id: input.brandId || null,
      description,
      cost_credits: creditsNeeded,
    })
    .then(({ error: usageError }: { error: { message?: string } | null }) => {
      if (usageError)
        logger.error('Failed to record usage', { source: 'credits', error: String(usageError) })
    })

  return {
    allowed: true,
    cost: creditsNeeded,
    type: 'paid',
    balance: Number(newBalance),
    message: `${creditsNeeded} credits used`,
  }
}
