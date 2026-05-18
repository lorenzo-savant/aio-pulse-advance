import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { verifyBrandAccess } from '@/lib/authorize'
import { dailyTrack } from '@/lib/services/serp-tracker'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const brandId = searchParams.get('brandId')
  const keywordsParam = searchParams.get('keywords')

  let userId: string
  try {
    userId = await getCurrentUserId(
      request.headers.get('authorization'),
      request.headers.get('cookie'),
    )
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const ip = getClientIp(request.headers)
  const rateCheck = await checkRateLimit(`serp-tracker:${ip}`, 10, 60_000)
  if (!rateCheck.success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
      },
    )
  }

  if (!brandId) {
    return NextResponse.json({ error: 'brandId required' }, { status: 400 })
  }

  if (!keywordsParam) {
    return NextResponse.json({ error: 'keywords required (comma-separated)' }, { status: 400 })
  }

  const db = createServerClient()
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  if (!(await verifyBrandAccess(brandId, userId))) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
  }

  const { data: brand, error: brandError } = await db
    .from('brands')
    .select('id, name, domain')
    .eq('id', brandId)
    .single()

  if (brandError || !brand) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
  }

  const keywords = keywordsParam
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)

  if (keywords.length === 0) {
    return NextResponse.json({ error: 'No valid keywords provided' }, { status: 400 })
  }

  try {
    const results = await dailyTrack(brandId, keywords, brand.domain || undefined)

    return NextResponse.json({
      brandId,
      brandName: brand.name,
      trackedAt: new Date().toISOString(),
      results,
    })
  } catch (error) {
    logger.error('/api/serp/tracker failed', { err: error })
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 })
  }
}
