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
    return NextResponse.json({ trend: [] })
  }

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const period = searchParams.get('period') || '30d'

  if (!brandId) {
    return NextResponse.json({ success: false, message: 'brand_id is required' }, { status: 400 })
  }
  if (!(await verifyBrandAccess(brandId, userId))) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
  }

  const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : period === '60d' ? 60 : 90
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysBack)

  try {
    const query = (supabase as any)
      .from('gsc_performance')
      .select('*')
      .eq('brand_id', brandId)
      .eq('dimension_type', 'date')
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true })

    const { data, error } = await query.limit(100)

    if (error || !data) {
      return NextResponse.json({ trend: [] })
    }

    const trend = (data || []).map((row: any) => ({
      date: row.date,
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }))

    return NextResponse.json({ trend })
  } catch (err) {
    logger.error('GSC API error', { err })
    return NextResponse.json({ trend: [] }, { status: 500 })
  }
}
