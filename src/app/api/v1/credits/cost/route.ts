// PATH: src/app/api/v1/credits/cost/route.ts
// GET /api/v1/credits/cost — Get cost by provider

import { type NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId, AuthError } from '@/lib/supabase'
import { getCostByProvider } from '@/lib/services/cost-aggregator'

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
  const provider = searchParams.get('provider')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) {
    return err('from and to query parameters are required (ISO date strings)', 400)
  }

  try {
    const costs = await getCostByProvider(userId, from, to)

    let filteredCosts = costs
    if (provider) {
      filteredCosts = costs.filter((c) => c.provider === provider)
    }

    return NextResponse.json({
      success: true,
      costs: filteredCosts,
      period: { from, to },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return err(`Failed to get cost data: ${error}`)
  }
}
