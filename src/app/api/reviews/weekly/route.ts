// PATH: src/app/api/reviews/weekly/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { AuthError, createServerClient, getCurrentUserId } from '@/lib/supabase'
import { getAccessibleBrandIds } from '@/lib/authorize'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cookieHeader = req.headers.get('cookie')
  let userId: string
  try {
    userId = await getCurrentUserId(authHeader, cookieHeader, req)
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode ?? 401 })
    }
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brandId')
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10) || 10, 52)
  const source = searchParams.get('source') || 'auto'

  const db = createServerClient()
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  // A weekly review reports on a brand, so the whole team reads it.
  const accessibleBrandIds = await getAccessibleBrandIds(db, userId)
  if (brandId && !accessibleBrandIds.includes(brandId)) {
    return NextResponse.json({ error: 'Brand not found or access denied' }, { status: 404 })
  }
  const scope = brandId ? [brandId] : accessibleBrandIds

  // Empty scope is a real answer (the caller has no brands), not an error to
  // push through PostgREST's `.in()` serialization. Same guard as /api/monitoring.
  if (scope.length === 0) {
    return NextResponse.json({ success: true, reviews: [], source })
  }

  // Try the new weekly_reviews table first
  if (source === 'auto' || source === 'weekly_reviews') {
    try {
      const query = db
        .from('weekly_reviews')
        .select(
          'id, brand_id, week_number, year, week_start, week_end, metrics, markdown, created_at',
        )
        .in('brand_id', scope)
        .order('created_at', { ascending: false })
        .limit(limit)

      const { data, error } = await query

      if (!error && data && data.length > 0) {
        return NextResponse.json({ success: true, reviews: data, source: 'weekly_reviews' })
      }
    } catch {
      // Fall through to legacy table
    }
  }

  // Fallback: legacy recommendation_histories
  const query = db
    .from('recommendation_history')
    .select('*')
    .in('brand_id', scope)
    .order('created_at', { ascending: false })
    .limit(limit)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
  }

  const weeklyReviews = (data || []).filter((r: any) => {
    const recs = Array.isArray(r.recommendations) ? r.recommendations : []
    return recs.some((rec: any) => rec.type === 'weekly-review')
  })

  return NextResponse.json({
    success: true,
    reviews: weeklyReviews,
    source: 'recommendation_histories',
  })
}
