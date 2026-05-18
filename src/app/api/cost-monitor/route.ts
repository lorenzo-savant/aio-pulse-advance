import { NextRequest, NextResponse } from 'next/server'
import { AuthError, getCurrentUserId } from '@/lib/supabase'
import { getCostTracker, getCostAnalytics, BudgetManager } from '@/lib/cost-monitor'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

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
    const body = await request.json()
    const { action, ...data } = body

    if (action === 'log') {
      const tracker = getCostTracker()
      const log = await tracker.logCost({
        userId,
        ...data,
      })
      return NextResponse.json({ log })
    }

    if (action === 'estimate') {
      const tracker = getCostTracker()
      const estimate = await tracker.estimateCost(
        data.provider,
        data.inputTokens,
        data.outputTokens,
        data.model,
      )
      return NextResponse.json({ estimate })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
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
    const body = await request.json()
    const { brandId, ...budgetData } = body

    const budgetManager = new BudgetManager()
    const budget = await budgetManager.updateBudget(userId, brandId || null, budgetData)

    return NextResponse.json({ budget })
  } catch (err) {
    logger.error('cost-monitor: PUT failed', { err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
