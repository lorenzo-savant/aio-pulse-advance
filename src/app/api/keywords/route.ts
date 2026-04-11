import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { verifyBrandAccess } from '@/lib/authorize'
import {
  trackKeywords,
  getKeywords,
  getTopCorrelatedKeywords,
} from '@/lib/services/keyword-tracker'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { logger } from '@/lib/logger'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// ─── GET /api/keywords ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`keywords-get:${ip}`, 30, 60_000)
  if (!rateCheck.success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    )
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const type = searchParams.get('type') || 'all'
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200)

  if (!brandId) {
    return err('brand_id is required', 400)
  }

  // Verify brand access (ownership or team membership)
  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) {
    return err('Brand not found or access denied', 404)
  }

  try {
    if (type === 'correlated') {
      const keywords = await getTopCorrelatedKeywords(brandId, limit)
      return NextResponse.json({ success: true, data: keywords })
    }

    const keywords = await getKeywords(brandId, limit)
    return NextResponse.json({ success: true, data: keywords })
  } catch (error) {
    logger.error('Keywords GET error', { route: '/api/keywords', error })
    return err('Failed to fetch keywords')
  }
}

// ─── POST /api/keywords ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`keywords-post:${ip}`, 10, 60_000)
  if (!rateCheck.success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    )
  }

  let body: { brand_id?: string; action?: string }
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  if (!body.brand_id) {
    return err('brand_id is required', 400)
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // Verify brand ownership
  const { data: brand } = await db
    .from('brands')
    .select('id')
    .eq('id', body.brand_id)
    .eq('user_id', userId)
    .single()

  if (!brand) {
    return err('Brand not found or access denied', 404)
  }

  try {
    if (body.action === 'refresh') {
      await trackKeywords(body.brand_id)
      return NextResponse.json({ success: true, message: 'Keywords refreshed' })
    }

    return err('Invalid action', 400)
  } catch (error) {
    logger.error('Keywords POST error', { route: '/api/keywords', error })
    return err('Failed to process keywords')
  }
}
