import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserId, AuthError } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { createServerClient } from '@/lib/supabase'
import { verifyBrandAccess } from '@/lib/authorize'
import { aggregateBrandData, buildAeoReportJson, sendToAeo } from '@/lib/aeo-bridge'
import { firstZodMessage } from '@/lib/validations'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const aeoBridgeExportSchema = z.object({
  brandId: z.string().min(1, 'brandId is required'),
  clientDomain: z.string().min(3, 'clientDomain must be at least 3 characters').max(255),
  dateRangeDays: z
    .number()
    .int()
    .min(1, 'dateRangeDays must be between 1 and 365')
    .max(365, 'dateRangeDays must be between 1 and 365')
    .optional(),
})

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

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`aeo-bridge-export:${ip}`, 5, 60_000)
  if (!rateCheck.success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
      },
    )
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = aeoBridgeExportSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: firstZodMessage(parsed.error) },
      { status: 400 },
    )
  }
  const { brandId, clientDomain, dateRangeDays = 30 } = parsed.data

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
    logger.error('Export error', { source: 'aeo-bridge/export', error: String(error) })
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
