// PATH: src/app/api/archive/compare/route.ts
// POST /api/archive/compare - Compare two periods
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { verifyBrandAccess } from '@/lib/authorize'

export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 })
  }

  const { brand_id, period1_from, period1_to, period2_from, period2_to } = body as {
    brand_id?: string
    period1_from?: string
    period1_to?: string
    period2_from?: string
    period2_to?: string
  }

  if (!brand_id || !period1_from || !period1_to || !period2_from || !period2_to) {
    return NextResponse.json(
      {
        success: false,
        message: 'brand_id, period1_from, period1_to, period2_from, period2_to are required',
      },
      { status: 400 },
    )
  }

  const db = createServerClient()
  if (!db) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  const brand = await verifyBrandAccess(brand_id, userId)
  if (!brand) {
    return NextResponse.json(
      { success: false, message: 'Brand not found or access denied' },
      { status: 403 },
    )
  }

  try {
    // Get period 1 data
    const { data: period1Data } = await db
      .from('brand_snapshots')
      .select(
        'health_score, sentiment_score, total_recommendations, completed_recommendations, queries_this_period',
      )
      .gte('snapshot_date', period1_from)
      .lte('snapshot_date', period1_to)
      .eq('brand_id', brand_id)

    const { data: period1Recs } = await db
      .from('recommendation_tracking')
      .select('id')
      .gte('last_seen_date', period1_from)
      .lte('last_seen_date', period1_to)
      .eq('brand_id', brand_id)
      .eq('status', 'active')

    // Get period 2 data
    const { data: period2Data } = await db
      .from('brand_snapshots')
      .select(
        'health_score, sentiment_score, total_recommendations, completed_recommendations, queries_this_period',
      )
      .gte('snapshot_date', period2_from)
      .lte('snapshot_date', period2_to)
      .eq('brand_id', brand_id)

    const { data: period2Recs } = await db
      .from('recommendation_tracking')
      .select('id, recommendation_text')
      .gte('last_seen_date', period2_from)
      .lte('last_seen_date', period2_to)
      .eq('brand_id', brand_id)
      .eq('status', 'active')

    // Calculate averages
    const period1 = period1Data as Array<Record<string, unknown>>
    const avg1 = period1?.length
      ? {
          healthScore: period1.reduce((a, b) => a + ((b.health_score as number) || 0), 0) / period1.length,
          sentiment:
            period1.reduce((a, b) => a + ((b.sentiment_score as number) || 0), 0) / period1.length,
          recommendations: period1.reduce((a, b) => a + ((b.total_recommendations as number) || 0), 0),
          queries: period1.reduce((a, b) => a + ((b.queries_this_period as number) || 0), 0),
        }
      : { healthScore: 0, sentiment: 0, recommendations: 0, queries: 0 }

    const period2 = period2Data as Array<Record<string, unknown>>
    const avg2 = period2?.length
      ? {
          healthScore: period2.reduce((a, b) => a + ((b.health_score as number) || 0), 0) / period2.length,
          sentiment:
            period2.reduce((a, b) => a + ((b.sentiment_score as number) || 0), 0) / period2.length,
          recommendations: period2.reduce((a, b) => a + ((b.total_recommendations as number) || 0), 0),
          queries: period2.reduce((a, b) => a + ((b.queries_this_period as number) || 0), 0),
        }
      : { healthScore: 0, sentiment: 0, recommendations: 0, queries: 0 }

    // Calculate changes
    const healthChange = avg2.healthScore - avg1.healthScore
    const sentimentChange = avg2.sentiment - avg1.sentiment
    const recChange = avg2.recommendations - avg1.recommendations
    const queryChange = avg2.queries - avg1.queries

    // Find new and disappeared recommendations
    const p1RecIds = new Set((period1Recs || []).map((r: Record<string, unknown>) => r.id))
    const p2RecIds = (period2Recs || []).map((r: Record<string, unknown>) => r.id)

    const newRecs = p2RecIds.filter((r) => !p1RecIds.has((r as Record<string, unknown>)?.id))
    const disappearedRecs =
      p1RecIds.size > 0
        ? (period1Recs || []).filter(
            (r: Record<string, unknown>) => !p2RecIds.some((p2) => (p2 as Record<string, unknown>)?.id === r.id),
          )
        : []
    const consistentRecs = p2RecIds.filter((r) => p1RecIds.has((r as Record<string, unknown>)?.id))

    return NextResponse.json({
      success: true,
      data: {
        period1: { from: period1_from, to: period1_to, ...avg1 },
        period2: { from: period2_from, to: period2_to, ...avg2 },
        changes: {
          healthScore: {
            value: healthChange,
            percentage: avg1.healthScore > 0 ? (healthChange / avg1.healthScore) * 100 : 0,
          },
          sentiment: {
            value: sentimentChange,
            percentage: avg1.sentiment > 0 ? (sentimentChange / avg1.sentiment) * 100 : 0,
          },
          recommendations: { value: recChange, count: recChange },
          queries: { value: queryChange, count: queryChange },
        },
        newRecommendations: newRecs,
        disappearedRecommendations: disappearedRecs,
        consistentRecommendations: consistentRecs,
      },
    })
  } catch (error) {
    console.error('[archive/compare] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to compare periods' },
      { status: 500 },
    )
  }
}
