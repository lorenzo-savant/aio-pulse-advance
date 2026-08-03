// PATH: src/app/api/credits/use/route.ts
// Credits Usage API — deduct credits when running queries.
// HTTP shell only: auth + rate limit + Zod. The consumption logic lives in
// src/lib/services/credits.ts and is shared with /api/monitoring.

import { type NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId, AuthError } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { creditsUseSchema, firstZodMessage } from '@/lib/validations'
import {
  consumeCreditsForQuery,
  CreditServiceError,
  CREDIT_COSTS,
  FREE_QUERIES_PER_DAY,
} from '@/lib/services/credits'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// ─── POST /api/credits/use — Use credits for a query ────────────────────────────
export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: e.statusCode })
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 401 })
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
    const decision = await consumeCreditsForQuery(userId, {
      engines,
      provider,
      brandId: brand_id,
      queryId: query_id,
    })

    if (!decision.allowed) {
      return NextResponse.json({
        success: false,
        message: decision.message,
        data: {
          allowed: false,
          cost: decision.cost,
          type: 'purchase',
        },
        error: 'INSUFFICIENT_CREDITS',
        timestamp: Date.now(),
      })
    }

    return NextResponse.json({
      success: true,
      data:
        decision.type === 'free'
          ? {
              allowed: true,
              cost: 0,
              type: 'free',
              remaining: decision.remaining,
              message: decision.message,
            }
          : {
              allowed: true,
              cost: decision.cost,
              type: 'paid',
              balance: decision.balance,
              message: decision.message,
            },
      timestamp: Date.now(),
    })
  } catch (error) {
    if (error instanceof CreditServiceError) {
      return err(
        error.message === 'Database not configured' ? error.message : 'Failed to check credits',
        503,
      )
    }
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
