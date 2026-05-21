// PATH: src/app/api/archive/recommendations/route.ts
// GET /api/archive/recommendations?brand_id=xxx&priority=xxx&category=xxx&status=xxx&limit=20&offset=0
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { verifyBrandAccess } from '@/lib/authorize'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const priority = searchParams.get('priority')
  const category = searchParams.get('category')
  const status = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 100)
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0)

  if (!brandId) {
    return NextResponse.json({ success: false, message: 'brand_id is required' }, { status: 400 })
  }

  const db = createServerClient()
  if (!db) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) {
    return NextResponse.json(
      { success: false, message: 'Brand not found or access denied' },
      { status: 403 },
    )
  }

  try {
    let query = db
      .from('recommendation_tracking')
      .select('*')
      .eq('brand_id', brandId)
      .eq('status', 'active')
      .order('last_seen_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (priority) query = query.eq('priority', priority)
    if (category) query = query.eq('category', category)
    if (status) query = query.eq('implementation_status', status)

    const { data: recommendations, error } = await query

    if (error) throw error

    // Get totals for filters
    const { count } = await db
      .from('recommendation_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('status', 'active')

    return NextResponse.json({
      success: true,
      data: {
        recommendations: recommendations || [],
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: offset + (recommendations?.length || 0) < (count || 0),
        },
      },
    })
  } catch (error) {
    logger.error('Recommendations error', {
      source: 'archive/recommendations',
      error: String(error),
    })
    return NextResponse.json(
      { success: false, message: 'Failed to fetch recommendations' },
      { status: 500 },
    )
  }
}

// PATCH /api/archive/recommendations - Update recommendation status
export async function PATCH(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 })
  }

  const { id, implementation_status, priority, notes } = body as {
    id?: string
    implementation_status?: string
    priority?: string
    notes?: string
  }

  if (!id) {
    return NextResponse.json(
      { success: false, message: 'Recommendation ID required' },
      { status: 400 },
    )
  }

  const db = createServerClient()
  if (!db) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  try {
    // Get recommendation and verify access
    const { data: rec, error: fetchError } = await db
      .from('recommendation_tracking')
      .select('brand_id')
      .eq('id', id)
      .single()

    if (fetchError || !rec) {
      return NextResponse.json(
        { success: false, message: 'Recommendation not found' },
        { status: 404 },
      )
    }

    const brand = await verifyBrandAccess(rec.brand_id, userId)
    if (!brand) {
      return NextResponse.json({ success: false, message: 'Access denied' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      user_last_updated_id: userId,
    }

    if (implementation_status) {
      updateData.implementation_status = implementation_status
      if (implementation_status === 'completed') {
        updateData.implementation_completion_date = new Date().toISOString()
      }
    }
    if (priority) updateData.priority = priority
    if (notes) updateData.notes = notes

    const { error: updateError } = await db
      .from('recommendation_tracking')
      .update(updateData)
      .eq('id', id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, message: 'Recommendation updated' })
  } catch (error) {
    logger.error('Recommendations update error', {
      source: 'archive/recommendations',
      error: String(error),
    })
    return NextResponse.json(
      { success: false, message: 'Failed to update recommendation' },
      { status: 500 },
    )
  }
}
