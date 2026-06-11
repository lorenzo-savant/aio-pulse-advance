import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AuthError, getCurrentUserId } from '@/lib/supabase'
import { getCostTracker, getCostAnalytics, BudgetManager } from '@/lib/cost-monitor'
import { firstZodMessage } from '@/lib/validations'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Discriminated on `action`, fully typed so the parsed object matches the
// cost-tracker's CostLogInput / estimateCost signatures without casts.
const costMonitorPostSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('log'),
    provider: z.string().max(60),
    brandId: z.string().max(100).optional(),
    agentType: z.string().max(60).optional(),
    conversationId: z.string().max(100).optional(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative(),
    costCredits: z.number().nonnegative(),
    latencyMs: z.number().optional(),
    endpoint: z.string().max(200).optional(),
    success: z.boolean(),
    errorMessage: z.string().max(2000).optional(),
    cached: z.boolean().optional(),
    model: z.string().max(100).optional(),
  }),
  z.object({
    action: z.literal('estimate'),
    provider: z.string().max(60),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    model: z.string().max(100).optional(),
  }),
])

const costMonitorPutSchema = z.object({
  brandId: z.string().max(100).nullish(),
  monthlyLimitUsd: z.number().optional(),
  dailyLimitUsd: z.number().nullish(),
  alertThreshold: z.number().optional(),
  providerLimits: z.record(z.string(), z.number()).optional(),
})

export async function GET(request: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(
      request.headers.get('authorization'),
      request.headers.get('cookie'),
    )
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode ?? 401 })
    }
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const brandId = searchParams.get('brandId')
    const days = parseInt(searchParams.get('days') || '30')
    const provider = searchParams.get('provider') || undefined

    if (action === 'budget') {
      const budgetManager = new BudgetManager()
      const budget = await budgetManager.getBudget(userId, brandId || null)
      return NextResponse.json({ budget })
    }

    if (action === 'alerts') {
      const tracker = getCostTracker()
      const alerts = await tracker.getBudgetAlerts(userId, brandId || null)
      return NextResponse.json({ alerts })
    }

    if (action === 'logs') {
      const tracker = getCostTracker()
      const limit = parseInt(searchParams.get('limit') || '100')
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      const logs = await tracker.getUserCosts(userId, {
        brandId: brandId || null,
        startDate,
        provider,
        limit,
      })
      return NextResponse.json({ logs })
    }

    const analytics = getCostAnalytics()
    const data = await analytics.getAnalytics(userId, {
      brandId: brandId || null,
      days,
      provider,
    })

    return NextResponse.json({ analytics: data })
  } catch (err) {
    logger.error('cost-monitor: GET failed', { err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(
      request.headers.get('authorization'),
      request.headers.get('cookie'),
    )
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode ?? 401 })
    }
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }

  try {
    const parsed = costMonitorPostSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstZodMessage(parsed.error, 'Invalid action') },
        { status: 400 },
      )
    }
    const input = parsed.data

    if (input.action === 'log') {
      const { action: _action, ...logInput } = input
      const tracker = getCostTracker()
      const log = await tracker.logCost({ userId, ...logInput })
      return NextResponse.json({ log })
    }

    const tracker = getCostTracker()
    const estimate = await tracker.estimateCost(
      input.provider,
      input.inputTokens,
      input.outputTokens,
      input.model,
    )
    return NextResponse.json({ estimate })
  } catch (err) {
    logger.error('cost-monitor: POST failed', { err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(
      request.headers.get('authorization'),
      request.headers.get('cookie'),
    )
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode ?? 401 })
    }
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }

  try {
    const parsed = costMonitorPutSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 400 })
    }
    const { brandId, ...budgetData } = parsed.data

    const budgetManager = new BudgetManager()
    const budget = await budgetManager.updateBudget(userId, brandId || null, budgetData)

    return NextResponse.json({ budget })
  } catch (err) {
    logger.error('cost-monitor: PUT failed', { err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
