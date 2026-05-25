// PATH: src/app/api/gsc/cannibalization/route.ts
//
// GET /api/gsc/cannibalization?brand_id=…&days=28&min_impressions=50
//
// Cross-references GSC's query × page matrix to surface queries where
// ≥2 of the brand's pages compete for the same term. Pure aggregation
// over GSC data — no extra paid API.

import { type NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { getGscProvider } from '@/lib/providers/gsc-provider'
import { detectCannibalization, type QueryPageRow } from '@/lib/utils/keyword-cannibalization'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

function dateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { startDate: iso(start), endDate: iso(end) }
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const days = Math.min(90, Math.max(7, Number(searchParams.get('days')) || 28))
  const minImpressions = Math.max(10, Number(searchParams.get('min_impressions')) || 50)
  const maxPosition = Math.min(100, Math.max(10, Number(searchParams.get('max_position')) || 50))

  if (!brandId) return err('brand_id is required', 400)
  if (!(await verifyBrandAccess(brandId, userId))) return err('Forbidden', 403)

  const provider = getGscProvider()
  if (!provider.isConfigured()) {
    return NextResponse.json({
      success: true,
      data: {
        report: null,
        reason: 'GSC not configured — cannibalization analysis is unavailable.',
      },
      timestamp: Date.now(),
    })
  }

  const siteUrl = process.env['GSC_SITE_URL'] || ''
  if (!siteUrl) {
    return NextResponse.json({
      success: true,
      data: {
        report: null,
        reason: 'GSC_SITE_URL is not set — cannibalization analysis is unavailable.',
      },
      timestamp: Date.now(),
    })
  }

  const { startDate, endDate } = dateRange(days)
  let rows: QueryPageRow[] = []
  try {
    const matrix = await provider.getQueryPageMatrix(siteUrl, startDate, endDate, 5000)
    rows = matrix
      .filter((r) => Array.isArray(r.keys) && r.keys.length >= 2)
      .map((r) => ({
        query: r.keys[0] ?? '',
        page: r.keys[1] ?? '',
        position: r.position ?? 0,
        impressions: r.impressions ?? 0,
        clicks: r.clicks ?? 0,
      }))
  } catch (e) {
    logger.warn('/api/gsc/cannibalization fetch failed', { err: String(e) })
    return err('Failed to fetch GSC query-page matrix')
  }

  const report = detectCannibalization(rows, { maxPosition, minImpressions })

  return NextResponse.json({
    success: true,
    data: {
      filters: { days, minImpressions, maxPosition, startDate, endDate },
      report,
    },
    timestamp: Date.now(),
  })
}
