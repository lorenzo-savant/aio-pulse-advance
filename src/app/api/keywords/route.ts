import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { logger } from '@/lib/logger'
import { trackKeywords } from '@/lib/services/keyword-tracker'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const supabase = createServerClient()
  if (!supabase) {
    return NextResponse.json({ data: [] })
  }

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const source = searchParams.get('source')
  const type = searchParams.get('type')
  const limitParam = searchParams.get('limit')

  if (!brandId) {
    return NextResponse.json({ success: false, message: 'brand_id is required' }, { status: 400 })
  }
  if (!(await verifyBrandAccess(brandId, userId))) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
  }

  try {
    if (source === 'tracking') {
      const limit = Math.min(parseInt(limitParam || '100', 10), 500)

      let query = (supabase as any).from('keyword_tracking').select('*').eq('brand_id', brandId)

      if (type === 'correlated') {
        query = query.gt('correlation_score', 0.3).order('correlation_score', { ascending: false })
      } else {
        query = query.order('mention_count', { ascending: false })
      }

      query = query.limit(limit)

      const { data, error } = await query

      if (error || !data) {
        return NextResponse.json({ data: [] })
      }

      const keywords = (data || []).map((row: any) => ({
        id: row.id,
        brand_id: row.brand_id,
        keyword: row.keyword,
        mention_count: row.mention_count ?? 0,
        correlation_score: row.correlation_score ?? 0,
        engines: row.engines ?? [],
        cluster: row.cluster ?? null,
        first_seen: row.first_seen ?? null,
        last_seen: row.last_seen ?? null,
      }))

      return NextResponse.json({ data: keywords })
    }

    const query = (supabase as any)
      .from('keyword_research')
      .select('*')
      .eq('brand_id', brandId)
      .order('search_volume', { ascending: false })
      .limit(50)

    const { data, error } = await query

    if (error || !data) {
      return NextResponse.json({ data: [] })
    }

    const keywords = (data || []).map((row: any) => ({
      keyword: row.keyword,
      searchVolume: row.search_volume || 0,
      competition: row.competition || 0,
      cpc: row.cpc || 0,
      intent: row.intent || 'informational',
    }))

    return NextResponse.json({ data: keywords })
  } catch (err) {
    logger.error('Keywords API error', { err })
    return NextResponse.json({ data: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const supabase = createServerClient()
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 500 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const brandId = body.brand_id

  if (!brandId) {
    return NextResponse.json({ success: false, message: 'brand_id is required' }, { status: 400 })
  }
  if (!(await verifyBrandAccess(brandId, userId))) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
  }

  try {
    await trackKeywords(brandId)
    return NextResponse.json({ success: true, message: 'Keywords refreshed' })
  } catch (err) {
    logger.error('Keywords refresh error', { err })
    return NextResponse.json(
      { success: false, message: 'Failed to refresh keywords' },
      { status: 500 },
    )
  }
}
