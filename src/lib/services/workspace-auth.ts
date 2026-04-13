import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export type Permission = 'manage_members' | 'view_audit' | 'edit_brand' | 'view_brand'

export type Role = 'owner' | 'admin' | 'editor' | 'viewer'

const PERMISSION_MATRIX: Record<Role, Permission[]> = {
  owner: ['manage_members', 'view_audit', 'edit_brand', 'view_brand'],
  admin: ['manage_members', 'view_audit', 'edit_brand', 'view_brand'],
  editor: ['edit_brand', 'view_brand'],
  viewer: ['view_brand'],
}

export function getRolePermissions(role: Role): Permission[] {
  return PERMISSION_MATRIX[role] ?? []
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSION_MATRIX[role]?.includes(permission) ?? false
}

interface WorkspaceMemberRow {
  workspace_id: string
  user_id: string
  role: string
  created_at: string
}

interface WorkspaceRow {
  id: string
  name: string
  slug: string
  created_at: string
  updated_at: string
}

interface AuditLogRow {
  id: string
  workspace_id: string
  user_id: string
  action: string
  resource: string
  ip: string | null
  user_agent: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export async function checkPermission(
  userId: string,
  workspaceId: string,
  permission: Permission,
): Promise<boolean> {
  const supabase = createServerClient()
  if (!supabase) return false

  const { data } = await (supabase as any)
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single()

  if (!data) {
    return false
  }

  return hasPermission(data.role as Role, permission)
}

export async function getUserRole(userId: string, workspaceId: string): Promise<Role | null> {
  const supabase = createServerClient()
  if (!supabase) return null

  const { data } = await (supabase as any)
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single()

  return (data?.role as Role) ?? null
}

export async function getWorkspaceMembers(workspaceId: string) {
  const supabase = createServerClient()
  if (!supabase) return []

  const { data } = await (supabase as any)
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  return (data ?? []) as WorkspaceMemberRow[]
}

export async function addWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: Role = 'viewer',
) {
  const supabase = createServerClient()
  if (!supabase) return null

  return (supabase as any).from('workspace_members').insert({
    workspace_id: workspaceId,
    user_id: userId,
    role,
  })
}

export async function updateWorkspaceMemberRole(workspaceId: string, userId: string, role: Role) {
  const supabase = createServerClient()
  if (!supabase) return null

  return (supabase as any)
    .from('workspace_members')
    .update({ role })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
}

export async function removeWorkspaceMember(workspaceId: string, userId: string) {
  const supabase = createServerClient()
  if (!supabase) return null

  return (supabase as any)
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
}

export async function createWorkspace(name: string, slug: string, ownerId: string) {
  const supabase = createServerClient()
  if (!supabase) return null

  const workspaceId = crypto.randomUUID()

  const { data: workspace, error } = await (supabase as any)
    .from('workspaces')
    .insert({
      id: workspaceId,
      name,
      slug,
    })
    .select()
    .single()

  if (error || !workspace) {
    logger.error('createWorkspace: failed to create workspace', { error })
    return null
  }

  await (supabase as any).from('workspace_members').insert({
    workspace_id: workspaceId,
    user_id: ownerId,
    role: 'owner',
  })

  return workspace as WorkspaceRow
}

export interface AuditLogInput {
  workspaceId: string
  userId: string
  action: string
  resource: string
  ip?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

export async function logAudit(input: AuditLogInput) {
  const supabase = createServerClient()
  if (!supabase) return null

  return (supabase as any).from('audit_logs').insert({
    workspace_id: input.workspaceId,
    user_id: input.userId,
    action: input.action,
    resource: input.resource,
    ip: input.ip,
    user_agent: input.userAgent,
    metadata: input.metadata ?? {},
  })
}

export async function getAuditLogs(
  workspaceId: string,
  options?: {
    userId?: string
    action?: string
    limit?: number
    offset?: number
  },
) {
  const supabase = createServerClient()
  if (!supabase) return []

  let query = (supabase as any)
    .from('audit_logs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (options?.userId) {
    query = query.eq('user_id', options.userId)
  }

  if (options?.action) {
    query = query.eq('action', options.action)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1)
  }

  const { data } = await query
  return (data ?? []) as AuditLogRow[]
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
