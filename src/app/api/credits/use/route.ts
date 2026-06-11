// PATH: src/app/api/credits/use/route.ts
// Credits Usage API — deduct credits when running queries

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { creditsUseSchema, firstZodMessage } from '@/lib/validations'

// Loose RPC shape — the generated Database type's rpc<> overloads gate by a
// fixed name union that doesn't include consume_free_query / deduct_credits.
// Cast the client to this minimal shape at the RPC boundary instead of `any`.
type RpcCapableClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
}

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// Credit cost per query by engine
const CREDIT_COSTS: Record<string, number> = {
  chatgpt: 2,
  gemini: 1,
  perplexity: 3,
  claude: 3,
  default: 2,
}

// Free queries per day (for free tier)
const FREE_QUERIES_PER_DAY = 10

// ─── POST /api/credits/use — Use credits for a query ────────────────────────────
export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`credits-use:${ip}`, 10, 60_000)
  if (!rateCheck.success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
      },
    )
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const parsed = creditsUseSchema.safeParse(rawBody)
  if (!parsed.success) {
    return err(firstZodMessage(parsed.error), 400)
  }
  const { engines = ['chatgpt'], provider, brand_id, query_id } = parsed.data

  try {
    // Check user's subscription status
    const { data: subscription, error: subError } = await db
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', userId)
      .single()

    if (subError && subError.code !== 'PGRST116') {
      throw subError
    }

    const isPaidUser = subscription?.status === 'active' && subscription?.plan !== 'free'

    // Calculate credits needed
    const defaultCost = CREDIT_COSTS['default'] ?? 2
    const creditsNeeded = engines.reduce((total, engine) => {
      return total + (CREDIT_COSTS[engine] ?? defaultCost)
    }, 0)

    // Check if user has free queries remaining today (for free tier).
    // Atomic: consume_free_query() increments a per-day counter under a row
    // lock, so concurrent requests cannot each pass the free check.
    if (!isPaidUser) {
      const { data: usedCount, error: freeErr } = await (db as unknown as RpcCapableClient).rpc(
        'consume_free_query',
        {
          p_user_id: userId,
          p_limit: FREE_QUERIES_PER_DAY,
        },
      )

      if (freeErr) {
        logger.error('consume_free_query RPC failed', {
          source: 'credits',
          err: freeErr.message,
        })
        return err('Failed to check credits', 503)
      }

      if (typeof usedCount === 'number') {
        return NextResponse.json({
          success: true,
          data: {
            allowed: true,
            cost: 0,
            type: 'free',
            remaining: Math.max(0, FREE_QUERIES_PER_DAY - usedCount),
            message: `Free query (${Math.max(0, FREE_QUERIES_PER_DAY - usedCount)} remaining today)`,
          },
          timestamp: Date.now(),
        })
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
      logger.error('deduct_credits RPC failed', {
        source: 'credits',
        err: deductError.message,
      })
      return err('Failed to check credits', 503)
    }

    if (newBalance === null || newBalance === undefined) {
      return NextResponse.json({
        success: false,
        message: `Insufficient credits. Need ${creditsNeeded}`,
        data: {
          allowed: false,
          cost: creditsNeeded,
          type: 'purchase',
        },
        error: 'INSUFFICIENT_CREDITS',
        timestamp: Date.now(),
      })
    }

    const balance = Number(newBalance) + creditsNeeded

    // Record usage (non-critical — log errors but don't fail the request)
    await db
      .from('credit_usage')
      .insert({
        user_id: userId,
        query_id: query_id || null,
        credits_used: creditsNeeded,
        provider: provider || engines[0],
        engine: engines.join(','),
        brand_id: brand_id || null,
        description,
        cost_credits: creditsNeeded,
      })
      .then(({ error: usageError }: { error: { message?: string } | null }) => {
        if (usageError)
          logger.error('Failed to record usage', { source: 'credits', error: String(usageError) })
      })

    return NextResponse.json({
      success: true,
      data: {
        allowed: true,
        cost: creditsNeeded,
        type: 'paid',
        balance: balance - creditsNeeded,
        message: `${creditsNeeded} credits used`,
      },
      timestamp: Date.now(),
    })
  } catch (error) {
    logger.error('Error checking credits', { source: 'credits', error: String(error) })
    return err('Failed to check credits')
  }
}

// ─── GET /api/credits/use — Get credit costs info ─────────────────────────────
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      costs: CREDIT_COSTS,
      freeQueriesPerDay: FREE_QUERIES_PER_DAY,
      explanation: {
        chatgpt: '2 credits per query',
        gemini: '1 credit per query (most efficient)',
        perplexity: '3 credits per query',
        claude: '3 credits per query',
      },
    },
    timestamp: Date.now(),
  })
}
