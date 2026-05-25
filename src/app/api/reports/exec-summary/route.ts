// PATH: src/app/api/reports/exec-summary/route.ts
//
// GET /api/reports/exec-summary?brand_id=…&days=30&format=json|md
//
// One-page executive AI-visibility summary built around the 4-question
// framework from the Semrush "AI search visibility reporting" piece.

import { type NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { buildExecSummary, execSummaryToMarkdown } from '@/lib/services/exec-summary'
import { logger } from '@/lib/logger'
import type { Brand } from '@/types'

export const dynamic = 'force-dynamic'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const days = Math.min(180, Math.max(7, Number(searchParams.get('days')) || 30))
  const format = (searchParams.get('format') || 'json').toLowerCase()

  if (!brandId) return err('brand_id is required', 400)
  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  try {
    const summary = await buildExecSummary(brand as Brand, days)
    if (format === 'md' || format === 'markdown') {
      const md = execSummaryToMarkdown(summary)
      return new NextResponse(md, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="ai-visibility-exec-summary-${summary.period.endDate}.md"`,
        },
      })
    }
    return NextResponse.json({ success: true, data: summary, timestamp: Date.now() })
  } catch (e) {
    logger.error('/api/reports/exec-summary failed', { err: String(e) })
    return err('Failed to build exec summary')
  }
}
