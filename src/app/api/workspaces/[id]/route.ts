import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { logger } from '@/lib/logger'
import { getUserRole } from '@/lib/services/workspace-auth'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * GET /api/workspaces/[id]
 *
 * Returns the workspace row to members of that workspace. Exists because the
 * workspace detail page (dashboard/workspaces/[id]) reads it — without this
 * route the page always rendered "Workspace not found".
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireUser(request)
    if (auth instanceof NextResponse) return auth
    const { userId } = auth

    const { id: workspaceId } = await params

    // Any member of the workspace may view it.
    if (!(await getUserRole(userId, workspaceId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const db = createServerClient()
    if (!db) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const { data: workspace, error } = await db
      .from('workspaces')
      .select('id, name, slug, description, organization_id, created_at, updated_at')
      .eq('id', workspaceId)
      .is('deleted_at', null)
      .single()

    if (error || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    return NextResponse.json(workspace)
  } catch (error) {
    logger.error('GET /api/workspaces/[id] failed', { err: error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
