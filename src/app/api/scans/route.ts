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

  // Resolve owned brands (handles user_id format mismatch on legacy rows)
  const { data: ownedBrands } = await db.from('brands').select('id').eq('user_id', userId)
  const ownedIds = (ownedBrands ?? []).map((b: { id: string }) => b.id)
  const rawFilterIds = brandId && ownedIds.includes(brandId) ? [brandId] : ownedIds

  // M-10: PostgREST filter injection hardening — only allow UUID-shaped values
  // into the `.or()` interpolation, and require userId itself to be UUID-shaped.
  const UUID_RE = /^[0-9a-fA-F-]{36}$/
  const filterIds = rawFilterIds.filter((id: string) => UUID_RE.test(id))
  if (!UUID_RE.test(userId)) {
    return err('Authentication failed')
  }

  let query = db
    .from('scan_history')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (filterIds.length > 0) {
    query = query.or(`user_id.eq.${userId},brand_id.in.(${filterIds.join(',')})`)
  } else {
    query = query.eq('user_id', userId)
  }

  const { data, error, count } = await query

  if (error) {
    // Missing table / relationship → empty result instead of 500 so dashboards
    // still render on fresh/partial DB setups.
    const msg = String((error as { message?: string })?.message ?? error)
    if (/does not exist|not found/i.test(msg)) {
      logger.warn('scan_history missing, returning empty', { route: '/api/scans', msg })
      return NextResponse.json({
        success: true,
        ...paginatedResponse([], 0, page, limit),
        timestamp: Date.now(),
        warning: 'scan_history table not yet migrated',
      })
    }
    logger.error('Scan load error', { route: '/api/scans', error })
    return err('Failed to load data')
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
    return err('Request failed')
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

  const { error } = await db.from('scan_history').delete().eq('id', scanId).eq('user_id', userId)

  if (error) {
    logger.error('Scan delete error', { route: '/api/scans', error })
    return err('Request failed')
  }

  return NextResponse.json({ success: true, timestamp: Date.now() })
}
