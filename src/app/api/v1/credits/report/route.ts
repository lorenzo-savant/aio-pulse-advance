// PATH: src/app/api/v1/credits/report/route.ts
// GET /api/v1/credits/report — Get full cost report by brand

import { type NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId, AuthError } from '@/lib/supabase'
import { getCostByBrand, getCostReport } from '@/lib/services/cost-aggregator'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brandId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) {
    return err('from and to query parameters are required (ISO date strings)', 400)
  }

  try {
    if (brandId) {
      const brandCosts = await getCostByBrand(userId, brandId, from, to)
      return NextResponse.json({
        success: true,
        report: brandCosts,
        period: { from, to },
        timestamp: new Date().toISOString(),
      })
    }

    const fullReport = await getCostReport(userId, from, to)
    return NextResponse.json({
      success: true,
      report: fullReport,
      period: { from, to },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return err(`Failed to get cost report: ${error}`)
  }
}
