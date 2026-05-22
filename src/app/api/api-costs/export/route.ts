// PATH: src/app/api/api-costs/export/route.ts
//
// GET /api/api-costs/export?format=csv|xlsx|pdf&granularity=day|week|month&from=&to=
// → downloadable API-cost breakdown (per period × provider) in the requested
// format. Auth-required: cost logs are user-scoped.
//
//   - csv  → text/csv (Excel-friendly, UTF-8 BOM)
//   - xlsx → SpreadsheetML 2003 (.xls) — opens in Excel/Sheets, no dependency
//   - pdf  → printable HTML served inline; the browser's print dialog
//            produces the PDF (matches the app's existing print-report pattern)

import { type NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId, AuthError } from '@/lib/supabase'
import { getCostBreakdown, type CostGranularity } from '@/lib/services/api-cost-overview'
import { costRowsToCsv, costRowsToExcelXml, costRowsToHtml } from '@/lib/export/cost-export'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const GRANULARITIES: CostGranularity[] = ['day', 'week', 'month']

function parseDate(raw: string | null): Date | undefined {
  if (!raw) return undefined
  const t = Date.parse(raw)
  return Number.isNaN(t) ? undefined : new Date(t)
}

export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    }
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 401 })
  }

  const params = req.nextUrl.searchParams
  const format = (params.get('format') ?? 'csv').toLowerCase()
  const granRaw = (params.get('granularity') ?? 'day').toLowerCase() as CostGranularity
  const granularity = GRANULARITIES.includes(granRaw) ? granRaw : 'day'
  const from = parseDate(params.get('from'))
  const to = parseDate(params.get('to'))

  if (!['csv', 'xlsx', 'pdf'].includes(format)) {
    return NextResponse.json(
      { success: false, message: `Unsupported format "${format}". Use csv, xlsx or pdf.` },
      { status: 400 },
    )
  }

  try {
    const breakdown = await getCostBreakdown(userId, { granularity, from, to })
    const meta = {
      granularity: breakdown.granularity,
      from: breakdown.from,
      to: breakdown.to,
      totalCostUsd: breakdown.totalCostUsd,
      totalCalls: breakdown.totalCalls,
      generatedAt: new Date().toISOString(),
    }
    const stamp = `${breakdown.from.slice(0, 10)}_${breakdown.to.slice(0, 10)}`
    const base = `aio-api-costs-${granularity}-${stamp}`

    if (format === 'csv') {
      return new NextResponse(costRowsToCsv(breakdown.rows, meta), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${base}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    if (format === 'xlsx') {
      return new NextResponse(costRowsToExcelXml(breakdown.rows, meta), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
          'Content-Disposition': `attachment; filename="${base}.xls"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    // pdf → printable HTML, served inline so the browser can render + print.
    return new NextResponse(costRowsToHtml(breakdown.rows, meta), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    logger.error('/api/api-costs/export failed', { err: String(err) })
    return NextResponse.json(
      { success: false, message: 'Failed to export API costs' },
      { status: 500 },
    )
  }
}
