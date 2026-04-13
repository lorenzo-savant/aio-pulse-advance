import { NextRequest, NextResponse } from 'next/server'
import { getSessionAnalytics } from '@/lib/analytics/session-analytics'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rateCheck = await checkRateLimit(`analytics-session:${ip}`, 30, 60_000)
    if (!rateCheck.success) {
      return NextResponse.json(
        { success: false, message: 'Rate limit exceeded. Try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
        },
      )
    }

    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brand_id')
    const sessionId = searchParams.get('session_id') || undefined

    if (!brandId) {
      return NextResponse.json({ success: false, message: 'brand_id is required' }, { status: 400 })
    }

    const analytics = await getSessionAnalytics(brandId, sessionId)

    if (!analytics) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No session data found',
      })
    }

    return NextResponse.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    logger.error('Session analytics error', { source: 'analytics/session', error: String(err) })
    return NextResponse.json(
      { success: false, message: 'Failed to get session analytics' },
      { status: 500 },
    )
  }
}
