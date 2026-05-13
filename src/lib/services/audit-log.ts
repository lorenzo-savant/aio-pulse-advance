import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.mfa.enabled'
  | 'auth.password.changed'
  | 'org.created'
  | 'org.deleted'
  | 'org.member.added'
  | 'org.member.removed'
  | 'org.member.role.changed'
  | 'workspace.created'
  | 'workspace.deleted'
  | 'workspace.member.added'
  | 'workspace.member.removed'
  | 'workspace.member.role.changed'
  | 'brand.created'
  | 'brand.deleted'
  | 'brand.restored'
  | 'brand.moved'
  | 'api_key.created'
  | 'api_key.revoked'
  | 'api_key.used'
  | 'billing.plan.changed'
  | 'billing.payment.succeeded'
  | 'billing.payment.failed'
  | 'data.exported'
  | 'data.deleted'
  | 'settings.changed'
  | 'sso.configured'

export interface AuditLogInput {
  organizationId: string
  workspaceId?: string
  actorId: string
  actorType?: 'user' | 'api_key' | 'system'
  actorApiKeyId?: string
  action: AuditAction
  resourceType: string
  resourceId?: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

// Audit log failure NEVER throws: audit is observability, not a gate.
// Business action must succeed even if audit insertion fails — error surfaces
// via logger instead, where it can be picked up by alerting.
export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    const db = createServerClient()
    if (!db) {
      logger.error('Audit log skipped: DB client unavailable', { action: input.action })
      return
    }

    const { error } = await db.from('audit_logs').insert({
      organization_id: input.organizationId,
      workspace_id: input.workspaceId ?? null,
      actor_id: input.actorId,
      actor_type: input.actorType ?? 'user',
      actor_api_key_id: input.actorApiKeyId ?? null,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      metadata: (input.metadata ?? {}) as never,
    })

    if (error) {
      logger.error('Audit log insert failed', {
        action: input.action,
        err: error.message,
      })
    }
  } catch (err) {
    logger.error('Audit log unexpected error', {
      action: input.action,
      err: err instanceof Error ? err.message : String(err),
    })
  }
}

export interface AuditLogFilters {
  workspaceId?: string
  actorId?: string
  action?: AuditAction
  resourceType?: string
  resourceId?: string
  from?: Date
  to?: Date
  limit?: number
  offset?: number
}

export async function listAuditLogs(organizationId: string, filters: AuditLogFilters = {}) {
  const db = createServerClient()
  if (!db) return []

  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0

  let query = db
    .from('audit_logs')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (filters.workspaceId) query = query.eq('workspace_id', filters.workspaceId)
  if (filters.actorId) query = query.eq('actor_id', filters.actorId)
  if (filters.action) query = query.eq('action', filters.action)
  if (filters.resourceType) query = query.eq('resource_type', filters.resourceType)
  if (filters.resourceId) query = query.eq('resource_id', filters.resourceId)
  if (filters.from) query = query.gte('created_at', filters.from.toISOString())
  if (filters.to) query = query.lte('created_at', filters.to.toISOString())

  const { data, error } = await query.range(offset, offset + limit - 1)
  if (error) {
    logger.error('Audit log query failed', { organizationId, err: error.message })
    return []
  }
  return data ?? []
}
