// PATH: src/app/api/archive/query/[id]/route.ts
// GET /api/archive/query/[id]
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { verifyBrandAccess } from '@/lib/authorize'
import { logger } from '@/lib/logger'

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

  const db = createServerClient()
  if (!db) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  try {
    // Get the archive query
    const { data: archive, error } = await db
      .from('research_archives')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !archive) {
      return NextResponse.json({ success: false, message: 'Archive not found' }, { status: 404 })
    }

    // Verify user has access to this brand
    if (!(await verifyBrandAccess(archive.brand_id, userId))) {
      return NextResponse.json({ success: false, message: 'Access denied' }, { status: 403 })
    }

    // Get recommendations for this archive
    const { data: recommendations } = await db
      .from('recommendation_tracking')
      .select('*')
      .eq('archive_id', id)
      .eq('status', 'active')

    // Get audit log for this archive
    const { data: auditLog } = await db
      .from('archive_audit_log')
      .select('*')
      .eq('record_id', id)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      success: true,
      data: {
        archive,
        recommendations: recommendations || [],
        auditLog: auditLog || [],
      },
    })
  } catch (error) {
    logger.error('Error fetching archive query', { route: '/api/archive/query/[id]', error })
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

  const db = createServerClient()
  if (!db) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  try {
    // Get the archive query
    const { data: archive, error: fetchError } = await db
      .from('research_archives')
      .select('brand_id')
      .eq('id', id)
      .single()

    if (fetchError || !archive) {
      return NextResponse.json({ success: false, message: 'Archive not found' }, { status: 404 })
    }

    // Verify user has access
    if (!(await verifyBrandAccess(archive.brand_id, userId))) {
      return NextResponse.json({ success: false, message: 'Access denied' }, { status: 403 })
    }

    const { data: brand } = await db
      .from('brands')
      .select('organization_id')
      .eq('id', archive.brand_id)
      .single()

    // Soft delete
    const { error: updateError } = await db
      .from('research_archives')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', id)

    if (updateError) throw updateError

    // Log to audit
    await db.from('archive_audit_log').insert({
      organization_id: brand?.organization_id,
      user_id: userId,
      table_name: 'research_archives',
      record_id: id,
      action: 'deleted',
      notes: 'Soft deleted via API',
    })

    return NextResponse.json({ success: true, message: 'Archive deleted' })
  } catch (error) {
    logger.error('Error deleting archive query', { route: '/api/archive/query/[id]', error })
    return NextResponse.json(
      { success: false, message: 'Failed to delete archive' },
      { status: 500 },
    )
  }
}
