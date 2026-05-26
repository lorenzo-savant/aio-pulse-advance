import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export type OrgRole = 'owner' | 'admin' | 'billing' | 'member'

const ORG_PERMISSION_MATRIX: Record<OrgRole, string[]> = {
  owner: [
    'manage_org_members',
    'manage_billing',
    'manage_workspaces',
    'manage_api_keys',
    'view_audit_logs',
    'manage_sso',
    'delete_org',
  ],
  admin: ['manage_org_members', 'manage_workspaces', 'manage_api_keys', 'view_audit_logs'],
  billing: ['manage_billing', 'view_billing'],
  member: ['view_workspaces'],
}

export interface OrganizationContext {
  id: string
  name: string
  slug: string
  plan: string
  role: OrgRole
  defaultWorkspaceId: string | null
}

export async function getCurrentOrganization(userId: string): Promise<OrganizationContext | null> {
  const db = createServerClient()
  if (!db) return null

  const { data: membership, error: membershipError } = await db
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError || !membership) {
    logger.debug('No organization membership found', { userId })
    return null
  }

  const { data: org, error: orgError } = await db
    .from('organizations')
    .select('id, name, slug, plan, default_workspace_id')
    .eq('id', membership.organization_id)
    .single()

  if (orgError || !org) {
    logger.error('Failed to fetch organization', {
      userId,
      orgId: membership.organization_id,
      err: orgError?.message,
    })
    return null
  }

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan: org.plan,
    role: membership.role as OrgRole,
    defaultWorkspaceId: org.default_workspace_id,
  }
}

export async function checkOrgPermission(
  userId: string,
  organizationId: string,
  permission: string,
): Promise<boolean> {
  const db = createServerClient()
  if (!db) return false

  const { data, error } = await db
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) {
    logger.debug('Org permission check failed', {
      userId,
      organizationId,
      permission,
      err: error?.message,
    })
    return false
  }

  const role = data.role as OrgRole
  return ORG_PERMISSION_MATRIX[role]?.includes(permission) ?? false
}

export async function getOrganizationMembers(organizationId: string) {
  const db = createServerClient()
  if (!db) return []

  const { data, error } = await db
    .from('organization_members')
    .select('*')
    .eq('organization_id', organizationId)
    .order('joined_at', { ascending: true })

  if (error) {
    logger.error('Failed to fetch organization members', {
      organizationId,
      err: error.message,
    })
    return []
  }

  return data ?? []
}

export async function addOrganizationMember(
  organizationId: string,
  userId: string,
  role: OrgRole = 'member',
  invitedBy?: string,
) {
  const db = createServerClient()
  if (!db) return null

  const { data, error } = await db
    .from('organization_members')
    .insert({
      organization_id: organizationId,
      user_id: userId,
      role,
      invited_by: invitedBy ?? null,
    })
    .select()
    .single()

  if (error) {
    logger.error('Failed to add organization member', {
      organizationId,
      userId,
      role,
      err: error.message,
    })
    return null
  }

  return data
}

export async function updateOrganizationMemberRole(
  organizationId: string,
  userId: string,
  role: OrgRole,
) {
  const db = createServerClient()
  if (!db) return null

  const { data, error } = await db
    .from('organization_members')
    .update({ role })
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    logger.error('Failed to update organization member role', {
      organizationId,
      userId,
      role,
      err: error.message,
    })
    return null
  }

  return data
}

export async function removeOrganizationMember(organizationId: string, userId: string) {
  const db = createServerClient()
  if (!db) return null

  const { error } = await db
    .from('organization_members')
    .delete()
    .eq('organization_id', organizationId)
    .eq('user_id', userId)

  if (error) {
    logger.error('Failed to remove organization member', {
      organizationId,
      userId,
      err: error.message,
    })
    return null
  }

  return true
}

export async function createOrganization(
  name: string,
  slug: string,
  ownerId: string,
): Promise<{ id: string } | null> {
  const db = createServerClient()
  if (!db) return null

  const orgId = crypto.randomUUID()

  const { data: org, error: orgError } = await db
    .from('organizations')
    .insert({
      id: orgId,
      name,
      slug,
      owner_id: ownerId,
      plan: 'free',
      status: 'active',
    })
    .select()
    .single()

  if (orgError || !org) {
    logger.error('createOrganization: failed', {
      err: orgError?.message,
      slug,
    })
    return null
  }

  const { error: memberError } = await db.from('organization_members').insert({
    organization_id: orgId,
    user_id: ownerId,
    role: 'owner',
  })

  if (memberError) {
    logger.error('createOrganization: failed to add owner as member', {
      err: memberError.message,
      orgId,
    })
    return null
  }

  return { id: orgId }
}

export async function getUserOrganizations(userId: string) {
  const db = createServerClient()
  if (!db) return []

  const { data, error } = await db
    .from('organization_members')
    .select('organization_id, role, organizations(id, name, slug, plan, default_workspace_id)')
    .eq('user_id', userId)

  if (error) {
    logger.error('Failed to fetch user organizations', {
      userId,
      err: error.message,
    })
    return []
  }

  type OrgRow = {
    role: string
    organizations: {
      id: string
      name: string
      slug: string | null
      plan: string | null
      default_workspace_id: string | null
    } | null
  }
  return ((data ?? []) as OrgRow[]).flatMap((m) =>
    m.organizations ? [{ ...m.organizations, role: m.role }] : [],
  )
}
