// PATH: src/app/api/scans/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { parsePaginationParams, paginatedResponse } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// ─── GET /api/scans — Load scan history ──────────────────────────────────────
export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const { page, limit, offset } = parsePaginationParams(searchParams, {
    defaultLimit: 20,
    maxLimit: 100,
  })

  let query = db
    .from('scan_history')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (brandId) {
    query = query.eq('brand_id', brandId)
  }

  const { data, error, count } = await query

  if (error) {
    logger.error('Scan load error', { route: '/api/scans', error })
    return err(error.message)
  }

  return NextResponse.json({
    success: true,
    ...paginatedResponse(data || [], count, page, limit),
    timestamp: Date.now(),
  })
}

// ─── POST /api/scans — Save a scan to history ───────────────────────────────
export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // Verify brand access if brand_id provided
  let brandId: string | null = null
  if (body.brand_id) {
    const { data: brand } = await db
      .from('brands')
      .select('id')
      .eq('id', body.brand_id)
      .eq('user_id', userId)
      .single()

    if (brand) {
      brandId = body.brand_id
    }
  }

  const { data, error } = await db
    .from('scan_history')
    .insert({
      user_id: userId,
      brand_id: brandId,
      source: body.source || '',
      type: body.type || 'text',
      summary: body.summary || '',
      visibility_score: body.visibility_score ?? 0,
      engine: body.engine || 'all',
      model: body.model || 'default',
      intent: body.intent || 'Informational',
      intent_confidence: body.intent_confidence ?? 0,
      content_type: body.content_type || 'Article',
      tone: body.tone || 'Professional',
      reading_level: body.reading_level || 'Undergraduate',
    })
    .select()
    .single()

  if (error) {
    logger.error('Scan save error', { route: '/api/scans', error })
    return err(error.message)
  }

  return NextResponse.json({
    success: true,
    data,
    timestamp: Date.now(),
  })
}

// ─── DELETE /api/scans — Delete a scan ──────────────────────────────────────
export async function DELETE(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const { searchParams } = new URL(req.url)
  const scanId = searchParams.get('id')

  if (!scanId) return err('id is required', 400)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { error } = await db
    .from('scan_history')
    .delete()
    .eq('id', scanId)
    .eq('user_id', userId)

  if (error) {
    logger.error('Scan delete error', { route: '/api/scans', error })
    return err(error.message)
  }

  return NextResponse.json({ success: true, timestamp: Date.now() })
}
