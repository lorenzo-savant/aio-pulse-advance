// PATH: src/app/api/reports/exec-summary/route.ts
//
// GET /api/reports/exec-summary?brand_id=…
//   &days=30                          (window for the snapshot report)
//   &format=json|md|tiered|trend
//   &months=6                         (only honoured when format=trend)
//
// Formats:
//   json     — 4-question structured payload (default)
//   md       — Markdown render of the 4 questions
//   tiered   — Tier 1 / Tier 2 / Tier 3 Markdown deck (industry template)
//   trend    — Monthly trend table over the last N months (Markdown)

import { type NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import {
  buildExecSummary,
  buildExecSummaryTrend,
  buildTieredKpiDeck,
  execSummaryToMarkdown,
  execSummaryTrendToMarkdown,
  tieredKpiDeckToMarkdown,
} from '@/lib/services/exec-summary'
import { logger } from '@/lib/logger'
import type { Brand } from '@/types'

export const dynamic = 'force-dynamic'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

function mdResponse(body: string, filename: string): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const days = Math.min(180, Math.max(7, Number(searchParams.get('days')) || 30))
  const format = (searchParams.get('format') || 'json').toLowerCase()
  const months = Math.min(12, Math.max(2, Number(searchParams.get('months')) || 6))

  if (!brandId) return err('brand_id is required', 400)
  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  try {
    if (format === 'trend') {
      const trend = await buildExecSummaryTrend(brand as Brand, months)
      const md = execSummaryTrendToMarkdown(trend)
      return mdResponse(md, `ai-visibility-trend-${months}m.md`)
    }

    const summary = await buildExecSummary(brand as Brand, days)

    if (format === 'tiered') {
      const deck = buildTieredKpiDeck(summary)
      const md = tieredKpiDeckToMarkdown(deck)
      return mdResponse(md, `ai-visibility-tiered-deck-${summary.period.endDate}.md`)
    }
    if (format === 'md' || format === 'markdown') {
      const md = execSummaryToMarkdown(summary)
      return mdResponse(md, `ai-visibility-exec-summary-${summary.period.endDate}.md`)
    }
    return NextResponse.json({ success: true, data: summary, timestamp: Date.now() })
  } catch (e) {
    logger.error('/api/reports/exec-summary failed', { err: String(e) })
    return err('Failed to build exec summary')
  }
}
