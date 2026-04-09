// PATH: src/app/api/archive/sentiment/route.ts
// GET /api/archive/sentiment?brand_id=xxx&from=xxx&to=xxx
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { verifyBrandAccess } from '@/lib/authorize'

export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!brandId) {
    return NextResponse.json({ success: false, message: 'brand_id is required' }, { status: 400 })
  }

  const db = createServerClient()
  if (!db) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) {
    return NextResponse.json(
      { success: false, message: 'Brand not found or access denied' },
      { status: 403 },
    )
  }

  try {
    let query = db
      .from('sentiment_history')
      .select('*')
      .eq('brand_id', brandId)
      .is('deleted_at', null)
      .order('snapshot_date', { ascending: true })

    if (from) {
      query = query.gte('snapshot_date', from)
    }
    if (to) {
      query = query.lte('snapshot_date', to)
    }

    const { data: sentiment, error } = (await query) as any

    if (error) throw error

    // Calculate statistics
    const scores = ((sentiment as any[]) || []).map((s: any) => s.sentiment_score)
    const avgSentiment =
      scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0
    const bestPeriod = scores.length > 0 ? Math.max(...scores) : 0
    const worstPeriod = scores.length > 0 ? Math.min(...scores) : 0

    // Determine trend
    const recent = ((sentiment as any[]) || []).slice(-7)
    const older = ((sentiment as any[]) || []).slice(-14, -7)
    const recentAvg =
      recent.length > 0
        ? recent.reduce((a: number, b: any) => a + b.sentiment_score, 0) / recent.length
        : 0
    const olderAvg =
      older.length > 0
        ? older.reduce((a: number, b: any) => a + b.sentiment_score, 0) / older.length
        : 0
    const trend = recentAvg > olderAvg ? 'improving' : recentAvg < olderAvg ? 'declining' : 'stable'

    return NextResponse.json({
      success: true,
      data: {
        timeline: sentiment || [],
        statistics: {
          average: avgSentiment,
          best: bestPeriod,
          worst: worstPeriod,
          trend,
          trendStrength: Math.abs(recentAvg - olderAvg) / 100,
        },
      },
    })
  } catch (error) {
    console.error('[archive/sentiment] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch sentiment data' },
      { status: 500 },
    )
  }
}
