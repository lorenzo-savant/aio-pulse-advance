import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/services/audit-log'

// T09 — Scoped API keys with permission model.
// Replaces the legacy plaintext `api_keys.key` column with prefix+bcrypt hash.
// Keys are generated server-side, shown to the user exactly ONCE, then stored
// only as bcrypt hash. Lookup uses indexed `key_prefix` to narrow before bcrypt.

export type ApiScope =
  | 'read:brands'
  | 'write:brands'
  | 'read:prompts'
  | 'write:prompts'
  | 'read:analytics'
  | 'write:webhooks'
  | 'read:audit'
  | 'manage:api_keys'
  | 'manage:billing'
  | 'manage:members'

export const ALL_SCOPES: readonly ApiScope[] = [
  'read:brands',
  'write:brands',
  'read:prompts',
  'write:prompts',
  'read:analytics',
  'write:webhooks',
  'read:audit',
  'manage:api_keys',
  'manage:billing',
  'manage:members',
] as const

export interface ApiKeyContext {
  organizationId: string
  apiKeyId: string
  scopes: string[]
}

export interface GeneratedKey {
  fullKey: string // shown to user once
  keyPrefix: string // 16-char visible prefix (aipulse_ + 8 random)
  keyHash: string // bcrypt hash to store
}

const KEY_PREFIX = 'aipulse_'
const RANDOM_BYTES = 24 // 24 bytes -> 32 url-safe chars
const BCRYPT_ROUNDS = 12

export async function generateApiKey(): Promise<GeneratedKey> {
  const random = crypto.randomBytes(RANDOM_BYTES).toString('base64url')
  const fullKey = `${KEY_PREFIX}${random}`
  // First 8 chars after the 'aipulse_' prefix become the lookup prefix.
  const keyPrefix = fullKey.slice(0, KEY_PREFIX.length + 8)
  const keyHash = await bcrypt.hash(fullKey, BCRYPT_ROUNDS)
  return { fullKey, keyPrefix, keyHash }
}

export async function verifyApiKey(
  authHeader: string | null | undefined,
  requiredScope: ApiScope,
): Promise<ApiKeyContext | null> {
  if (!authHeader?.startsWith('Bearer ')) return null

  const fullKey = authHeader.slice(7).trim()
  if (!fullKey.startsWith(KEY_PREFIX)) return null

  const keyPrefix = fullKey.slice(0, KEY_PREFIX.length + 8)

  const db = createServerClient()
  if (!db) return null

  // Indexed prefix narrows candidate set before any bcrypt compare.
  const { data: candidates, error } = await db
    .from('api_keys')
    .select('id, organization_id, key_hash, scopes, revoked_at, expires_at')
    .eq('key_prefix', keyPrefix)
    .is('revoked_at', null)

  if (error) {
    logger.error('API key lookup failed', { err: error.message })
    return null
  }
  if (!candidates || candidates.length === 0) return null

  const now = Date.now()
  for (const candidate of candidates) {
    if (!candidate.key_hash) continue
    if (candidate.expires_at && new Date(candidate.expires_at).getTime() < now) continue

    const matches = await bcrypt.compare(fullKey, candidate.key_hash)
    if (!matches) continue

    if (!candidate.scopes.includes(requiredScope)) {
      logger.warn('API key valid but missing required scope', {
        apiKeyId: candidate.id,
        requiredScope,
      })
      return null
    }

    if (!candidate.organization_id) {
      // Legacy key not yet migrated to org-level. Reject — caller should not get a
      // null org context, since downstream queries rely on it for tenancy.
      logger.warn('API key valid but lacks organization_id (pre-migration)', {
        apiKeyId: candidate.id,
      })
      return null
    }

    // Best-effort side updates — never block verification path.
    void db
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', candidate.id)

    void logAudit({
      organizationId: candidate.organization_id,
      actorId: candidate.id,
      actorType: 'api_key',
      actorApiKeyId: candidate.id,
      action: 'api_key.used',
      resourceType: 'api',
      metadata: { requiredScope },
    })

    return {
      organizationId: candidate.organization_id,
      apiKeyId: candidate.id,
      scopes: candidate.scopes,
    }
  }

  return null
}
