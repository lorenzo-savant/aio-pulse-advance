import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { logger } from '@/lib/logger'

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

  if (!brandId) {
    return NextResponse.json({ success: false, message: 'brand_id is required' }, { status: 400 })
  }
  if (!(await verifyBrandAccess(brandId, userId))) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
  }

  try {
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
