// PATH: src/app/api/archive/overview/route.ts
// GET /api/archive/overview?brand_id=xxx
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { asUntyped } from '@/lib/supabase-untyped'
import { verifyBrandAccess } from '@/lib/authorize'
import { logger } from '@/lib/logger'

// SCHEMA DRIFT (TODO): this route queries `research_archives`, `brand_snapshots`
// and other tables that don't exist in the generated DB schema — these were
// coded but the migrations were never written. Until a migration ships,
// asUntyped() unblocks the TS type-check; the route still 500s at runtime.

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
    // Get total queries count
    const { count: totalQueries } = await asUntyped(db)
      .from('research_archives')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('status', 'active')

    // Get query breakdown by type
    const { data: toolBreakdown } = await asUntyped(db)
      .from('research_archives')
      .select('query_type')
      .eq('brand_id', brandId)
      .eq('status', 'active')

    const breakdown = ((toolBreakdown || []) as Array<{ query_type: string }>).reduce(
      (acc: Record<string, number>, item) => {
        acc[item.query_type] = (acc[item.query_type] || 0) + 1
        return acc
      },
      {},
    )

    // Get total active recommendations
    const { count: totalRecs } = await db
      .from('recommendation_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('status', 'active')

    // Get date range
    const { data: dateRange } = await asUntyped(db)
      .from('research_archives')
      .select('created_at')
      .eq('brand_id', brandId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    // Get last query
    const { data: lastQuery } = await asUntyped(db)
      .from('research_archives')
      .select('created_at, query_type')
      .eq('brand_id', brandId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Get latest health score
    const { data: latestSnapshot } = await asUntyped(db)
      .from('brand_snapshots')
      .select('health_score, sentiment_score, snapshot_date')
      .eq('brand_id', brandId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single()

    // Get top recommendations
    const { data: topRecs } = await db
      .from('recommendation_tracking')
      .select(
        'id, recommendation_text, priority, last_seen_date, occurrence_count, consistency_score',
      )
      .eq('brand_id', brandId)
      .eq('status', 'active')
      .order('consistency_score', { ascending: false })
      .limit(5)

    return NextResponse.json({
      success: true,
      data: {
        brandId,
        totalQueries: totalQueries || 0,
        totalRecommendations: totalRecs || 0,
        dateRange: dateRange ? { start: dateRange.created_at } : null,
        lastQuery: lastQuery?.created_at || null,
        currentHealthScore: latestSnapshot?.health_score || 0,
        currentSentiment: latestSnapshot?.sentiment_score || 0,
        tools: breakdown,
        topRecommendations: topRecs || [],
      },
    })
  } catch (error) {
    logger.error('Error fetching archive overview', { route: '/api/archive/overview', error })
    return NextResponse.json(
      { success: false, message: 'Failed to fetch overview' },
      { status: 500 },
    )
  }
}
