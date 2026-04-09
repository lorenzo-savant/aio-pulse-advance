import { NextRequest, NextResponse } from 'next/server'
import { getLifetimeAnalytics } from '@/lib/analytics/lifetime-analytics'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brand_id')

    if (!brandId) {
      return NextResponse.json({ success: false, message: 'brand_id is required' }, { status: 400 })
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
    console.error('Lifetime analytics error:', err)
    return NextResponse.json(
      { success: false, message: 'Failed to get lifetime analytics' },
      { status: 500 },
    )
  }
}
