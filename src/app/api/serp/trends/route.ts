import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { getTrends } from '@/lib/services/serp-tracker'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const brandId = searchParams.get('brandId')
  const daysParam = searchParams.get('days')

  let userId: string
  try {
    userId = await getCurrentUserId(
      request.headers.get('authorization'),
      request.headers.get('cookie'),
    )
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 500 })
  }

  if (!brandId) {
    return NextResponse.json({ error: 'brandId required' }, { status: 400 })
  }

  const days = daysParam ? parseInt(daysParam, 10) : 30

  if (isNaN(days) || days < 1 || days > 365) {
    return NextResponse.json({ error: 'days must be between 1 and 365' }, { status: 400 })
  }

  const db = createServerClient()
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  const { data: brand, error: brandError } = await db
    .from('brands')
    .select('id, name')
    .eq('id', brandId)
    .eq('user_id', userId)
    .single()

  if (brandError || !brand) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
  }

  try {
    const trends = await getTrends(brandId, days)

    return NextResponse.json({
      brandId,
      brandName: brand.name,
      days,
      generatedAt: new Date().toISOString(),
      trends,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch trends' },
      { status: 500 },
    )
  }
}
