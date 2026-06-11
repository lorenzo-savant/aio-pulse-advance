import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/services/audit-log'
import {
  workspaceMemberAddSchema,
  workspaceMemberRoleSchema,
  firstZodMessage,
} from '@/lib/validations'
import {
  addWorkspaceMember,
  getWorkspaceMembers,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
  canManageMembers,
  getUserRole,
} from '@/lib/services/workspace-auth'

interface Params {
  params: Promise<{ id: string }>
}

/** Number of remaining 'owner' members in a workspace (last-owner protection). */
async function ownerCount(workspaceId: string): Promise<number> {
  const db = createServerClient()
  if (!db) return 0
  const { count } = await db
    .from('workspace_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('role', 'owner')
  return count ?? 0
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireUser(request)
    if (auth instanceof NextResponse) return auth
    const { userId } = auth

    const { id: workspaceId } = await params

    // Any member of the workspace may view the member list.
    if (!(await getUserRole(userId, workspaceId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const members = await getWorkspaceMembers(workspaceId)
    return NextResponse.json(members)
  } catch (error) {
    logger.error('GET /api/workspaces/[id]/members failed', { err: error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireUser(request)
    if (auth instanceof NextResponse) return auth
    const { userId: actorId } = auth

    const { id: workspaceId } = await params
    const parsed = workspaceMemberAddSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 400 })
    }
    const { userId: targetUserId, role } = parsed.data

    if (!(await canManageMembers(actorId, workspaceId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await addWorkspaceMember(workspaceId, targetUserId, role ?? 'viewer', actorId)
    if (!result || result.error) {
      logger.error('addWorkspaceMember failed', { err: result?.error?.message })
      return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
    }

    const db = createServerClient()
    const { data: workspace } = db
      ? await db.from('workspaces').select('organization_id').eq('id', workspaceId).single()
      : { data: null }

    await logAudit({
      organizationId: workspace?.organization_id ?? '',
      workspaceId,
      actorId,
      action: 'workspace.member.added',
      resourceType: 'workspace_member',
      resourceId: targetUserId,
      metadata: { role: role ?? 'viewer' },
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    logger.error('POST /api/workspaces/[id]/members failed', { err: error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireUser(request)
    if (auth instanceof NextResponse) return auth
    const { userId: actorId } = auth

    const { id: workspaceId } = await params
    const parsed = workspaceMemberRoleSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 400 })
    }
    const { userId: targetUserId, role } = parsed.data

    if (!(await canManageMembers(actorId, workspaceId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Last-owner protection: don't allow demoting the only owner.
    if (role !== 'owner') {
      const currentRole = await getUserRole(targetUserId, workspaceId)
      if (currentRole === 'owner' && (await ownerCount(workspaceId)) <= 1) {
        return NextResponse.json(
          { error: 'Cannot demote the last owner of the workspace' },
          { status: 409 },
        )
      }
    }

    const result = await updateWorkspaceMemberRole(workspaceId, targetUserId, role)
    if (!result || result.error) {
      logger.error('updateWorkspaceMemberRole failed', { err: result?.error?.message })
      return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 })
    }

    const db = createServerClient()
    const { data: workspace } = db
      ? await db.from('workspaces').select('organization_id').eq('id', workspaceId).single()
      : { data: null }

    await logAudit({
      organizationId: workspace?.organization_id ?? '',
      workspaceId,
      actorId,
      action: 'workspace.member.role.changed',
      resourceType: 'workspace_member',
      resourceId: targetUserId,
      metadata: { role },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('PATCH /api/workspaces/[id]/members failed', { err: error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireUser(request)
    if (auth instanceof NextResponse) return auth
    const { userId: actorId } = auth

    const { id: workspaceId } = await params
    const targetUserId = request.nextUrl.searchParams.get('userId')

    if (!targetUserId || !workspaceId) {
      return NextResponse.json({ error: 'userId and workspaceId required' }, { status: 400 })
    }

    if (!(await canManageMembers(actorId, workspaceId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Last-owner protection: don't allow removing the only owner.
    const targetRole = await getUserRole(targetUserId, workspaceId)
    if (targetRole === 'owner' && (await ownerCount(workspaceId)) <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove the last owner of the workspace' },
        { status: 409 },
      )
    }

    const result = await removeWorkspaceMember(workspaceId, targetUserId)
    if (!result || result.error) {
      logger.error('removeWorkspaceMember failed', { err: result?.error?.message })
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
    }

    const db = createServerClient()
    const { data: workspace } = db
      ? await db.from('workspaces').select('organization_id').eq('id', workspaceId).single()
      : { data: null }

    await logAudit({
      organizationId: workspace?.organization_id ?? '',
      workspaceId,
      actorId,
      action: 'workspace.member.removed',
      resourceType: 'workspace_member',
      resourceId: targetUserId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('DELETE /api/workspaces/[id]/members failed', { err: error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
