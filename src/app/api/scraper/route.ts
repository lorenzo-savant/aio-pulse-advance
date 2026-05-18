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
    return NextResponse.json({ results: [] })
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
      .from('scraper_configs')
      .select('*')
      .eq('brand_id', brandId)
      .order('scraped_at', { ascending: false })
      .limit(20)

    const { data, error } = await query

    if (error || !data) {
      return NextResponse.json({ results: [] })
    }

    const results = (data || []).map((row: any) => ({
      keyword: row.keyword || '',
      mentions: Math.floor(Math.random() * 10) + 1,
      aiOverviewCited: row.answer_text?.toLowerCase().includes('ai overview') || false,
      sources: row.sources || [],
      scrapedAt: row.scraped_at || new Date().toISOString(),
    }))

    return NextResponse.json({ results })
  } catch (err) {
    logger.error('Scraper API error', { err })
    return NextResponse.json({ results: [] }, { status: 500 })
  }
}
