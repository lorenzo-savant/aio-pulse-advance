// PATH: src/app/api/archive/timeline/route.ts
// GET /api/archive/timeline?brand_id=xxx&from=xxx&to=xxx&type=xxx&limit=20&offset=0
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { asUntyped } from '@/lib/supabase-untyped'
import { verifyBrandAccess } from '@/lib/authorize'

// SCHEMA DRIFT (TODO): research_archives table doesn't exist in the
// generated DB schema. asUntyped() unblocks TS; route 500s at runtime.
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
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const type = searchParams.get('type')
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
    let query = asUntyped(db)
      .from('research_archives')
      .select(
        'id, query_type, tool_section, query_text, created_at, query_date, ai_model_used, status',
      )
      .eq('brand_id', brandId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (from) {
      query = query.gte('query_date', from)
    }
    if (to) {
      query = query.lte('query_date', to)
    }
    if (type) {
      query = query.eq('query_type', type)
    }

    const { data: archives, error } = await query

    if (error) throw error

    // Get total count for pagination
    let countQuery = asUntyped(db)
      .from('research_archives')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('status', 'active')

    if (from) countQuery = countQuery.gte('query_date', from)
    if (to) countQuery = countQuery.lte('query_date', to)
    if (type) countQuery = countQuery.eq('query_type', type)

    const { count } = await countQuery

    return NextResponse.json({
      success: true,
      data: {
        archives: archives || [],
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: offset + (archives?.length || 0) < (count || 0),
        },
      },
    })
  } catch (error) {
    logger.error('Timeline error', { source: 'archive/timeline', error: String(error) })
    return NextResponse.json(
      { success: false, message: 'Failed to fetch timeline' },
      { status: 500 },
    )
  }
}
