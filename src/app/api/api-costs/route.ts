// PATH: src/app/api/api-costs/route.ts
//
// GET /api/api-costs → unified spend snapshot across SERP providers,
// AI providers, and the user's credit ledger. Auth-required because
// AI cost logs and credits are user-scoped.

import { type NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId, AuthError } from '@/lib/supabase'
import { getApiCostOverview } from '@/lib/services/api-cost-overview'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

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

  try {
    const overview = await getApiCostOverview(userId)
    return NextResponse.json({ success: true, data: overview, timestamp: Date.now() })
  } catch (err) {
    logger.error('/api/api-costs failed', { err: String(err) })
    return NextResponse.json(
      { success: false, message: 'Failed to load API cost overview' },
      { status: 500 },
    )
  }
}
