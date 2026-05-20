import { NextRequest, NextResponse } from 'next/server'
import { getLifetimeAnalytics } from '@/lib/analytics/lifetime-analytics'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rateCheck = await checkRateLimit(`analytics-lifetime:${ip}`, 30, 60_000)
    if (!rateCheck.success) {
      return NextResponse.json(
        { success: false, message: 'Rate limit exceeded. Try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
        },
      )
    }

    // Auth gate: lifetime analytics is per-brand tenant data — must require a
    // logged-in user AND verify they have access to the requested brand.
    const auth = await requireUser(request)
    if (auth instanceof NextResponse) return auth
    const { userId } = auth

    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brand_id')

    if (!brandId) {
      return NextResponse.json({ success: false, message: 'brand_id is required' }, { status: 400 })
    }

    if (!(await verifyBrandAccess(brandId, userId))) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }

    const analytics = await getLifetimeAnalytics(brandId)

    if (!analytics) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No lifetime data found',
      })
    }

    return NextResponse.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    logger.error('Lifetime analytics error', { source: 'analytics/lifetime', error: String(err) })
    return NextResponse.json(
      { success: false, message: 'Failed to get lifetime analytics' },
      { status: 500 },
    )
  }
}
