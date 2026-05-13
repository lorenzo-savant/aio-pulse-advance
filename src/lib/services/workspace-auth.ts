import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

// T07 — Workspace permissions. Now type-safe against the real workspace_members
// table (no more `as any` casts). Role matrix mirrors the Fase 1 design doc.
export type Permission =
  | 'manage_members'
  | 'view_audit'
  | 'edit_brand'
  | 'view_brand'
  | 'manage_billing'
  | 'manage_api_keys'

export type Role = 'owner' | 'admin' | 'editor' | 'viewer'

const PERMISSION_MATRIX: Record<Role, Permission[]> = {
  owner: [
    'manage_members',
    'view_audit',
    'edit_brand',
    'view_brand',
    'manage_billing',
    'manage_api_keys',
  ],
  admin: ['manage_members', 'view_audit', 'edit_brand', 'view_brand', 'manage_api_keys'],
  editor: ['edit_brand', 'view_brand'],
  viewer: ['view_brand'],
}

export function getRolePermissions(role: Role): Permission[] {
  return PERMISSION_MATRIX[role] ?? []
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSION_MATRIX[role]?.includes(permission) ?? false
}

export async function checkPermission(
  userId: string,
  workspaceId: string,
  permission: Permission,
): Promise<boolean> {
  const db = createServerClient()
  if (!db) return false

  const { data, error } = await db
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    logger.debug('Permission check failed', {
      userId,
      workspaceId,
      permission,
      err: error.message,
    })
    return false
  }
  if (!data) return false

  return hasPermission(data.role as Role, permission)
}

export async function getUserRole(userId: string, workspaceId: string): Promise<Role | null> {
  const db = createServerClient()
  if (!db) return null

  const { data } = await db
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  return (data?.role as Role) ?? null
}

export async function getWorkspaceMembers(workspaceId: string) {
  const db = createServerClient()
  if (!db) return []

  const { data } = await db
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('joined_at', { ascending: true })

  return data ?? []
}

export async function addWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: Role = 'viewer',
  invitedBy?: string,
) {
  const db = createServerClient()
  if (!db) return null

  return db.from('workspace_members').insert({
    workspace_id: workspaceId,
    user_id: userId,
    role,
    invited_by: invitedBy ?? null,
  })
}

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  role: Role,
) {
  const db = createServerClient()
  if (!db) return null

  return db
    .from('workspace_members')
    .update({ role })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
}

export async function removeWorkspaceMember(workspaceId: string, userId: string) {
  const db = createServerClient()
  if (!db) return null

  return db
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
}

export async function createWorkspace(
  organizationId: string,
  name: string,
  slug: string,
  ownerId: string,
) {
  const db = createServerClient()
  if (!db) return null

  const workspaceId = crypto.randomUUID()

  const { data: workspace, error } = await db
    .from('workspaces')
    .insert({
      id: workspaceId,
      organization_id: organizationId,
      name,
      slug,
    })
    .select()
    .single()

  if (error || !workspace) {
    logger.error('createWorkspace: failed to create workspace', {
      err: error?.message,
      organizationId,
      slug,
    })
    return null
  }

  await db.from('workspace_members').insert({
    workspace_id: workspaceId,
    user_id: ownerId,
    role: 'owner',
  })

  return workspace
}

export async function isWorkspaceOwner(userId: string, workspaceId: string): Promise<boolean> {
  const role = await getUserRole(userId, workspaceId)
  return role === 'owner'
}

export async function canManageMembers(userId: string, workspaceId: string): Promise<boolean> {
  return checkPermission(userId, workspaceId, 'manage_members')
}

export async function canEditBrand(userId: string, workspaceId: string): Promise<boolean> {
  return checkPermission(userId, workspaceId, 'edit_brand')
}

export async function canViewBrand(userId: string, workspaceId: string): Promise<boolean> {
  return checkPermission(userId, workspaceId, 'view_brand')
}

export async function canViewAudit(userId: string, workspaceId: string): Promise<boolean> {
  return checkPermission(userId, workspaceId, 'view_audit')
}

// Re-export logAudit from its canonical location for back-compat with existing
// callers that imported it from this module. New code should import directly
// from `@/lib/services/audit-log`.
export { logAudit, type AuditLogInput } from './audit-log'
