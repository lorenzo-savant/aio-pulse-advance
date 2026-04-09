// PATH: src/app/api/archive/query/[id]/route.ts
// GET /api/archive/query/[id]
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ success: false, message: 'Query ID is required' }, { status: 400 })
  }

  const db = createServerClient() as any
  if (!db) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  try {
    // Get the archive query
    const { data: archive, error } = (await db
      .from('research_archives')
      .select('*')
      .eq('id', id)
      .single()) as any

    if (error || !archive) {
      return NextResponse.json({ success: false, message: 'Archive not found' }, { status: 404 })
    }

    // Verify user has access to this brand
    const { data: brand } = (await db
      .from('brands')
      .select('id, user_id')
      .eq('id', archive.brand_id)
      .single()) as any

    if (!brand || String(brand.user_id) !== userId) {
      return NextResponse.json({ success: false, message: 'Access denied' }, { status: 403 })
    }

    // Get recommendations for this archive
    const { data: recommendations } = (await db
      .from('recommendation_tracking')
      .select('*')
      .eq('archive_id', id)
      .eq('status', 'active')) as any

    // Get audit log for this archive
    const { data: auditLog } = (await db
      .from('archive_audit_log')
      .select('*')
      .eq('record_id', id)
      .order('created_at', { ascending: false })
      .limit(20)) as any

    return NextResponse.json({
      success: true,
      data: {
        archive,
        recommendations: recommendations || [],
        auditLog: auditLog || [],
      },
    })
  } catch (error) {
    console.error('[archive/query] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch archive query' },
      { status: 500 },
    )
  }
}

// DELETE /api/archive/query/[id] - Soft delete
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ success: false, message: 'Query ID is required' }, { status: 400 })
  }

  const db = createServerClient() as any
  if (!db) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  try {
    // Get the archive query
    const { data: archive, error: fetchError } = (await db
      .from('research_archives')
      .select('brand_id')
      .eq('id', id)
      .single()) as any

    if (fetchError || !archive) {
      return NextResponse.json({ success: false, message: 'Archive not found' }, { status: 404 })
    }

    // Verify user has access
    const { data: brand } = (await db
      .from('brands')
      .select('user_id, organization_id')
      .eq('id', archive.brand_id)
      .single()) as any

    if (!brand || String(brand.user_id) !== userId) {
      return NextResponse.json({ success: false, message: 'Access denied' }, { status: 403 })
    }

    // Soft delete
    const dbAny = db as any
    const { error: updateError } = await dbAny
      .from('research_archives')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', id)

    if (updateError) throw updateError

    // Log to audit
    await dbAny.from('archive_audit_log').insert({
      organization_id: brand.organization_id,
      user_id: userId,
      table_name: 'research_archives',
      record_id: id,
      action: 'deleted',
      notes: 'Soft deleted via API',
    })

    return NextResponse.json({ success: true, message: 'Archive deleted' })
  } catch (error) {
    console.error('[archive/query] Delete error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to delete archive' },
      { status: 500 },
    )
  }
}
