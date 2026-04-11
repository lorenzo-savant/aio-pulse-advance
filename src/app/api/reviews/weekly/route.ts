// PATH: src/app/api/reviews/weekly/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cookieHeader = req.headers.get('cookie')
  const userId = await getCurrentUserId(authHeader, cookieHeader, req)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brandId')
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 52)

  const db = createServerClient()

  let query = (db as any)
    .from('recommendation_histories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (brandId) {
    query = query.eq('brand_id', brandId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
  }

  // Filter for weekly reviews client-side since Supabase JSON contains is tricky
  const weeklyReviews = (data || []).filter((r: any) => {
    const recs = Array.isArray(r.recommendations) ? r.recommendations : []
    return recs.some((rec: any) => rec.type === 'weekly-review')
  })

  return NextResponse.json({ success: true, reviews: weeklyReviews })
}
