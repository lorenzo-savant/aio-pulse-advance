import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { checkRateLimit, type RateLimitResult } from '@/lib/ratelimit'
import { createServerClient } from '@/lib/supabase'

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Resolve a public-API key (X-API-Key header) to its owning user id.
 * Returns null for unknown/revoked/expired keys or when the DB is unavailable.
 *
 * Single definition on purpose: this used to be copy-pasted verbatim into
 * all four /api/v1 routes, so a revocation-check fix in one would silently
 * miss the other three.
 *
 * The key is looked up on `api_keys.key_hash` (a sha256 of the raw key). It
 * previously compared against `user_api_keys.encrypted_key`, which stores an
 * AES-256-GCM ciphertext — the two values could never match, so every v1
 * request was rejected with 401.
 */
export async function verifyApiKey(apiKey: string): Promise<string | null> {
  const keyHash = hashApiKey(apiKey)
  const db = createServerClient()
  if (!db) return null

  const { data, error } = await db
    .from('api_keys')
    .select('user_id, revoked_at, expires_at')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (error || !data) return null
  if (data.revoked_at) return null
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null

  // Best-effort touch: keep the "last used" column fresh for the settings UI.
  await db
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', keyHash)

  return data.user_id
}

export function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex')
  const signatureBuffer = Buffer.from(signature, 'hex')
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')
  if (signatureBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(signatureBuffer, expectedBuffer)
}

// Public v1 API rate-limit: 60 req/min per API-key user.
//
// Previously this used an in-process Map<>, which is incorrect on serverless
// (Vercel) — each cold-start container resets the counter, so an attacker can
// burst-cycle containers and bypass the limit entirely. We now delegate to
// the shared Upstash-backed checkRateLimit (src/lib/ratelimit.ts) which is
// the same surface the global middleware uses.
export const PUBLIC_API_RATE_LIMIT = 60
export const PUBLIC_API_RATE_WINDOW_MS = 60_000

export function publicApiRateLimit(identifier: string): Promise<RateLimitResult> {
  return checkRateLimit(identifier, PUBLIC_API_RATE_LIMIT, PUBLIC_API_RATE_WINDOW_MS)
}
