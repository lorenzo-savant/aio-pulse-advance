// PATH: src/app/api/ai-seo-readiness/route.ts
//
// GET /api/ai-seo-readiness?brand_id=… → 0-100 readiness score with the
// itemised checks behind it.

import { type NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { computeReadinessReport } from '@/lib/services/ai-seo-readiness'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const brandId = req.nextUrl.searchParams.get('brand_id')
  if (!brandId) {
    return NextResponse.json({ success: false, message: 'brand_id is required' }, { status: 400 })
  }
  if (!(await verifyBrandAccess(brandId, userId))) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
  }

  const report = await computeReadinessReport(brandId)
  return NextResponse.json({ success: true, data: report, timestamp: Date.now() })
}
