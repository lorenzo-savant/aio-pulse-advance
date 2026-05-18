import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/services/audit-log'

export interface ApiKeyContext {
  organizationId: string
  apiKeyId: string
  scopes: string[]
}

export async function verifyApiKey(
  authHeader: string | undefined,
  requiredScope: string,
): Promise<ApiKeyContext | null> {
  if (!authHeader?.startsWith('Bearer ')) return null

  const fullKey = authHeader.slice(7)
  if (!fullKey.startsWith('aipulse_')) return null

  const keyPrefix = fullKey.slice(0, 16)

  const db = createServerClient()
  if (!db) return null

  const { data: candidates, error } = await db
    .from('api_keys')
    .select('id, organization_id, key_hash, scopes, revoked_at, expires_at')
    .eq('key_prefix', keyPrefix)
    .is('revoked_at', null)

  if (error || !candidates?.length) {
    if (error) {
      logger.error('API key verification failed', { err: error.message })
    }
    return null
  }

  for (const candidate of candidates) {
    if (candidate.expires_at && new Date(candidate.expires_at) < new Date()) continue
    if (!candidate.key_hash) continue

    const bcrypt = await import('bcryptjs')
    const isValid = await bcrypt.compare(fullKey, candidate.key_hash)

    if (isValid) {
      if (!candidate.scopes.includes(requiredScope)) {
        logger.warn('API key valid but missing scope', {
          apiKeyId: candidate.id,
          requiredScope,
          scopes: candidate.scopes,
        })
        return null
      }

      void db
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', candidate.id)

      void logAudit({
        organizationId: candidate.organization_id ?? '',
        actorId: candidate.id,
        actorType: 'api_key',
        actorApiKeyId: candidate.id,
        action: 'api_key.used',
        resourceType: 'api',
        metadata: { requiredScope },
      })

      return {
        organizationId: candidate.organization_id ?? '',
        apiKeyId: candidate.id,
        scopes: candidate.scopes,
      }
    }
  }

  return null
}
