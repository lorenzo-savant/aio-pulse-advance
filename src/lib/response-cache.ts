// ─── Response cache helper (Upstash Redis) ───────────────────────────────────
//
// Why: endpoints like /api/health-scores, /api/v1/brands/:id/avi, the docs
// glossary, and any per-day aggregate snapshot are recomputed many times per
// hour by the dashboard auto-refresh. The result changes only when a fresh
// monitoring scan completes (every 6-8 h). Caching the response body for a
// short TTL collapses that to one DB read per cache lifetime.
//
// What this is NOT:
//  - Not a replacement for HTTP/CDN cache (use Cache-Control headers for that)
//  - Not for personalized data (the cache key MUST encode every variable that
//    changes the response, including userId/workspaceId)
//  - Not for write paths
//
// Failure model:
//  - Redis miss or any error → cache MISS, fall through to the underlying
//    fetcher. We never serve stale or fail the request on cache trouble.
//  - In dev without Upstash configured, every call is a MISS — same path.
// ─────────────────────────────────────────────────────────────────────────────

import { Redis } from '@upstash/redis'
import { logger } from '@/lib/logger'

let redisClient: Redis | null | undefined

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient
  const url = process.env['UPSTASH_REDIS_REST_URL']
  const token = process.env['UPSTASH_REDIS_REST_TOKEN']
  if (!url || !token) {
    redisClient = null
    return null
  }
  redisClient = new Redis({ url, token })
  return redisClient
}

const CACHE_PREFIX = 'aio-pulse:rc:'

export interface CacheOptions {
  /** Cache key — MUST include every input that changes the response. */
  key: string
  /** TTL in seconds. Default 300 (5 minutes). */
  ttlSeconds?: number
  /**
   * Optional cache-version namespace. Bumping this in the call sites
   * effectively invalidates all entries with the old version — useful when
   * the response shape changes.
   */
  version?: string
}

/**
 * Get-or-compute pattern. Returns either the cached value (parsed from JSON)
 * or the result of calling `compute()`, caching it.
 *
 *     const data = await cached(
 *       { key: `avi:${brandId}`, ttlSeconds: 300 },
 *       () => computeAvi(brandId),
 *     )
 */
export async function cached<T>(opts: CacheOptions, compute: () => Promise<T>): Promise<T> {
  const redis = getRedis()
  const fullKey = `${CACHE_PREFIX}${opts.version ?? 'v1'}:${opts.key}`

  if (redis) {
    try {
      const hit = await redis.get<T>(fullKey)
      if (hit !== null && hit !== undefined) return hit
    } catch (e) {
      // Treat all Redis errors as MISS — never block the user on cache trouble.
      logger.warn('[response-cache] read failed, falling through', {
        key: fullKey,
        err: e instanceof Error ? e.message : 'unknown',
      })
    }
  }

  const value = await compute()

  if (redis) {
    try {
      await redis.set(fullKey, value, { ex: opts.ttlSeconds ?? 300 })
    } catch (e) {
      // Likewise — failure to write is non-fatal.
      logger.warn('[response-cache] write failed', {
        key: fullKey,
        err: e instanceof Error ? e.message : 'unknown',
      })
    }
  }

  return value
}

/**
 * Explicit invalidation. Call from write paths that mutate the cached data.
 * Idempotent — silently no-ops if Redis is unconfigured.
 */
export async function invalidate(key: string, version = 'v1'): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  const fullKey = `${CACHE_PREFIX}${version}:${key}`
  try {
    await redis.del(fullKey)
  } catch (e) {
    logger.warn('[response-cache] invalidate failed', {
      key: fullKey,
      err: e instanceof Error ? e.message : 'unknown',
    })
  }
}

/**
 * Bulk invalidate by prefix. Use sparingly — Redis SCAN is O(n).
 * Typical use: after a fresh monitoring scan completes for a brand,
 * clear every cached aggregate keyed by that brand id.
 */
export async function invalidatePrefix(prefix: string, version = 'v1'): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  const match = `${CACHE_PREFIX}${version}:${prefix}*`
  try {
    let cursor: string | number = 0
    do {
      const [next, batch] = (await redis.scan(cursor, { match, count: 100 })) as [string, string[]]
      if (batch.length > 0) await redis.del(...batch)
      cursor = next === '0' ? 0 : next
    } while (cursor !== 0)
  } catch (e) {
    logger.warn('[response-cache] invalidatePrefix failed', {
      prefix,
      err: e instanceof Error ? e.message : 'unknown',
    })
  }
}
