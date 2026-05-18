import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/services/audit-log'
import { getUserOrganizations, checkOrgPermission } from '@/lib/services/organization-auth'
import { createWorkspace } from '@/lib/services/workspace-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if (auth instanceof NextResponse) return auth
    const { userId } = auth

    const db = createServerClient()
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
    }

    const orgs = await getUserOrganizations(userId)

    const workspaces = []
    for (const org of orgs) {
      const { data: orgWorkspaces, error } = await db
        .from('workspaces')
        .select('id, name, slug, organization_id')
        .eq('organization_id', org.id)
        .is('deleted_at', null)

      if (error) {
        logger.error('Failed to fetch workspaces', { orgId: org.id, err: error.message })
        continue
      }

      workspaces.push(
        ...(orgWorkspaces ?? []).map((ws) => ({
          id: ws.id,
          name: ws.name,
          slug: ws.slug,
          organizationId: ws.organization_id,
          organizationName: org.name,
          role: org.role,
        })),
      )
    }

    return NextResponse.json(workspaces)
  } catch (error) {
    logger.error('GET /api/workspaces failed', { err: error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if (auth instanceof NextResponse) return auth
    const { userId } = auth

    const body = await request.json()
    const { name, slug, organizationId } = body

    if (!name || !slug || !organizationId) {
      return NextResponse.json(
        { error: 'name, slug, and organizationId required' },
        { status: 400 },
      )
    }

    if (!(await checkOrgPermission(userId, organizationId, 'manage_workspaces'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const workspace = await createWorkspace(organizationId, name, slug, userId)

    if (!workspace) {
      return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 })
    }

    await logAudit({
      organizationId,
      workspaceId: workspace.id,
      actorId: userId,
      action: 'workspace.created',
      resourceType: 'workspace',
      resourceId: workspace.id,
      metadata: { name, slug },
    })

    return NextResponse.json(workspace, { status: 201 })
  } catch (error) {
    logger.error('POST /api/workspaces failed', { err: error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
