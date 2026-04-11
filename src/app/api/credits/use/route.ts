// PATH: src/app/api/credits/use/route.ts
// Credits Usage API — deduct credits when running queries

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { calculateOrchestratedCost } from '@/lib/services/cost-calculator'

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

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  let body: {
    engines?: string[]
    provider?: string
    brand_id?: string
    query_id?: string
  }
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const { engines = ['chatgpt'], provider, brand_id, query_id } = body

  try {
    // Check user's subscription status
    const { data: subscription, error: subError } = await (db as any)
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

    // Check if user has free queries remaining today (for free tier)
    if (!isPaidUser) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data: todayUsage } = await (db as any)
        .from('credit_usage')
        .select('count')
        .eq('user_id', userId)
        .gte('created_at', today.toISOString())

      const queriesToday = todayUsage?.length || 0

      if (queriesToday < FREE_QUERIES_PER_DAY) {
        // User has free queries available
        return NextResponse.json({
          success: true,
          data: {
            allowed: true,
            cost: 0,
            type: 'free',
            remaining: FREE_QUERIES_PER_DAY - queriesToday - 1,
            message: `Free query (${FREE_QUERIES_PER_DAY - queriesToday} remaining today)`,
          },
          timestamp: Date.now(),
        })
      }
    }

    // Check credit balance for paid users or free users who exceeded free limit
    const { data: credits, error: creditsError } = await (db as any)
      .from('credits')
      .select('amount')
      .eq('user_id', userId)

    if (creditsError) throw creditsError

    const totalPurchased =
      credits
        ?.filter((c: any) => c.amount > 0)
        .reduce((sum: number, c: any) => sum + c.amount, 0) || 0

    const totalUsed =
      credits
        ?.filter((c: any) => c.amount < 0)
        .reduce((sum: number, c: any) => sum + Math.abs(c.amount), 0) || 0

    const balance = totalPurchased - totalUsed

    if (balance < creditsNeeded) {
      return NextResponse.json({
        success: false,
        message: `Insufficient credits. Need ${creditsNeeded}, have ${balance}`,
        data: {
          allowed: false,
          cost: creditsNeeded,
          balance,
          type: 'purchase',
        },
        error: 'INSUFFICIENT_CREDITS',
        timestamp: Date.now(),
      })
    }

    // Deduct credits + record usage atomically
    // Insert both in sequence — if deduction fails, usage is not recorded
    const description = `Query with ${engines.join(', ')}`

    const { error: deductError } = await (db as any).from('credits').insert({
      user_id: userId,
      amount: -creditsNeeded,
      source: 'query_usage',
      description,
    })

    if (deductError) throw deductError

    // Record usage (non-critical — log errors but don't fail the request)
    await (db as any)
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
      .then(({ error: usageError }: { error: any }) => {
        if (usageError) console.error('[credits] Failed to record usage:', usageError)
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
    console.error('[credits] Error checking credits:', error)
    return err('Failed to check credits')
  }
}

// ─── GET /api/credits/use — Get credit costs info ─────────────────────────────
export async function GET(req: NextRequest) {
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
