import { NextRequest, NextResponse } from 'next/server'
import { getSessionAnalytics } from '@/lib/analytics/session-analytics'

export async function GET(request: NextRequest) {
  try {
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
    console.error('Session analytics error:', err)
    return NextResponse.json(
      { success: false, message: 'Failed to get session analytics' },
      { status: 500 },
    )
  }
}
