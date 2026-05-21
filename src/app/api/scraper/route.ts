import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
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
    // Previously this route queried `scraper_configs` (the configuration
    // table) and synthesised `mentions` via Math.random — both wrong. The
    // real data lives in `monitoring_results` (each row = one scraper run
    // against an engine), so we read from there and surface its actual
    // columns. No mocks.
    const { data, error } = await supabase
      .from('monitoring_results')
      .select('prompt_text, response_text, mention_count, cited_urls, created_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error || !data) {
      return NextResponse.json({ results: [] })
    }

    const results = data.map((row) => ({
      keyword: row.prompt_text || '',
      mentions: row.mention_count ?? 0,
      // True if the engine response explicitly cites Google's AI Overview
      // as a source. Substring-match on the response text is a heuristic;
      // we'd upgrade this to a structured signal once the monitoring writer
      // tags AIO citations explicitly.
      aiOverviewCited:
        typeof row.response_text === 'string'
          ? row.response_text.toLowerCase().includes('ai overview')
          : false,
      sources: Array.isArray(row.cited_urls) ? (row.cited_urls as string[]) : [],
      scrapedAt: row.created_at || new Date().toISOString(),
    }))

    return NextResponse.json({ results })
  } catch (err) {
    logger.error('Scraper API error', { err })
    return NextResponse.json({ results: [] }, { status: 500 })
  }
}
