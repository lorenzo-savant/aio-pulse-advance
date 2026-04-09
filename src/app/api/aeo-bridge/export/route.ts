import { type NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId, AuthError } from '@/lib/supabase'
import { createServerClient } from '@/lib/supabase'
import { verifyBrandAccess } from '@/lib/authorize'
import { aggregateBrandData, buildAeoReportJson, sendToAeo } from '@/lib/aeo-bridge'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface ExportRequestBody {
  brandId: string
  clientDomain: string
  dateRangeDays?: number
}

export async function POST(req: NextRequest) {
  let userId: string

  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    }
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 401 })
  }

  let body: ExportRequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { brandId, clientDomain, dateRangeDays = 30 } = body

  if (!brandId || typeof brandId !== 'string') {
    return NextResponse.json({ success: false, message: 'brandId is required' }, { status: 400 })
  }

  if (!clientDomain || typeof clientDomain !== 'string' || clientDomain.length < 3) {
    return NextResponse.json(
      { success: false, message: 'clientDomain must be at least 3 characters' },
      { status: 400 },
    )
  }

  if (dateRangeDays < 1 || dateRangeDays > 365) {
    return NextResponse.json(
      { success: false, message: 'dateRangeDays must be between 1 and 365' },
      { status: 400 },
    )
  }

  const db = createServerClient()
  if (!db) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  const brand = await verifyBrandAccess(brandId, userId, true)
  if (!brand) {
    return NextResponse.json(
      { success: false, message: 'Brand not found or access denied' },
      { status: 403 },
    )
  }

  try {
    const data = await aggregateBrandData(brandId, dateRangeDays)

    const { data: brandData, error: brandError } = await db
      .from('brands')
      .select('id, name, domain, competitors, industry, aliases, color')
      .eq('id', brandId)
      .single()

    if (brandError || !brandData) {
      return NextResponse.json(
        { success: false, message: 'Failed to fetch brand data' },
        { status: 500 },
      )
    }

    const reportJson = buildAeoReportJson({
      brand: brandData as Record<string, unknown>,
      ...data,
      dateRangeDays,
      trigger: 'manual',
    })

    const result = await sendToAeo({
      clientDomain,
      reportJson,
      aioVisibilityScore: reportJson.visibility.ai_score,
    })

    if (!result.success) {
      if (result.error?.includes('Client not found')) {
        return NextResponse.json(
          { success: false, message: 'Client not found in AEO system. Verify domain mapping.' },
          { status: 404 },
        )
      }
      return NextResponse.json({ success: false, message: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      run_id: result.runId,
      trigger: 'manual',
      data_points: data.results.length,
      completeness_score: reportJson.meta.completeness_score,
      message: 'AEO analysis triggered successfully',
    })
  } catch (error) {
    console.error('[/api/aeo-bridge/export] Error:', error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
