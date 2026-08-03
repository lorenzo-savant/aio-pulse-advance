// PATH: src/lib/services/llm-cache.ts
//
// LLM response cache + in-process promise coalescing. Sibling of
// serp-cache.ts, but Redis-backed: LLM payloads are large, short-lived and
// high-churn, which suits Upstash better than a Postgres TTL table.
//
// Two layers, both keyed on a deterministic hash of {surface, engine, scope,
// payload}:
//
//   1) In-memory promise map (per-process). Two concurrent calls with the
//      same key share one provider round-trip. This is the double-spend
//      guard: a double-clicked "run scan", a cron overlapping a manual run,
//      or a retry storm costs ONE call instead of N. Always on, even at
//      ttl 0 — it never changes what the user sees.
//
//   2) Upstash Redis TTL cache. Persists across lambdas/deploys. Opt-in per
//      call site via ttlSeconds, because for some surfaces (monitoring data
//      collection) "re-run" must mean a genuinely fresh sample.
//
// Usage:
//
//   const text = await withLlmCache(
//     { surface: 'analysis', engine: 'chatgpt', payload: { prompt } },
//     () => callOpenAI(prompt),
//     { ttlSeconds: 3600 },
//   )
//
// Failure model: any Redis error degrades to a MISS. We never fail a user
// request, and never serve a value we could not verify.

import { createHash } from 'crypto'
import { Redis } from '@upstash/redis'
import { logger } from '@/lib/logger'

/** Which product surface issued the call — namespaces the key space. */
export type LlmCacheSurface =
  | 'monitoring'
  | 'analysis'
  | 'prompt-generator'
  | 'sentiment'
  | 'competitor'

export interface LlmCacheKey {
  surface: LlmCacheSurface
  /** Provider/engine id — the same prompt on two engines is two entries. */
  engine: string
  /**
   * Tenant/entity scope. Include brandId (and anything else that changes the
   * meaning of the response) so two tenants can never share an entry.
   */
  scope?: string
  /** The actual inputs. Key order is normalized before hashing. */
  payload: Record<string, unknown>
}

export interface LlmCacheOptions {
  /**
   * Redis TTL. 0 (default) = coalescing only, nothing is persisted —
   * the safe default, since it cannot change observable behaviour.
   * Negative = bypass every layer (forced refresh).
   */
  ttlSeconds?: number
  /**
   * Gate the write. Use it to avoid persisting empty/degenerate results —
   * an empty completion is usually a transient provider hiccup, and caching
   * it would poison every retry for the whole TTL.
   */
  shouldCache?: (result: unknown) => boolean
}

const CACHE_PREFIX = 'aio-pulse:llm:'

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

/** Stable JSON: sort keys so {a:1,b:2} and {b:2,a:1} hash identically. */
function normalize(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload).sort()
  const ordered: Record<string, unknown> = {}
  for (const k of keys) ordered[k] = payload[k]
  return JSON.stringify(ordered)
}

export function hashLlmKey(key: LlmCacheKey): string {
  const normalized = `${key.surface}::${key.engine}::${key.scope ?? '-'}::${normalize(key.payload)}`
  return createHash('sha256').update(normalized).digest('hex')
}

/** In-process promise map for request coalescing. */
const inflight = new Map<string, Promise<unknown>>()

/** Non-empty result heuristic — the default `shouldCache` for text payloads. */
export function isNonEmptyResult(result: unknown): boolean {
  if (result === null || result === undefined) return false
  if (typeof result === 'string') return result.trim().length > 0
  if (Array.isArray(result)) return result.length > 0
  return true
}

/**
 * Cache-or-call with in-process dedup. `call` runs at most once per key per
 * TTL window, and at most once concurrently per process.
 */
export async function withLlmCache<T>(
  key: LlmCacheKey,
  call: () => Promise<T>,
  options?: LlmCacheOptions,
): Promise<T> {
  const ttl = options?.ttlSeconds ?? 0

  // Negative TTL = forced refresh: skip coalescing too, so an explicit
  // "regenerate" never returns another caller's in-flight answer.
  if (ttl < 0) return call()

  const hash = hashLlmKey(key)
  const memoryKey = `${key.surface}::${key.engine}::${hash}`

  // Layer 1. Lookup AND registration must both happen synchronously at entry,
  // otherwise concurrent callers race past the first await before any of them
  // installs the inflight entry, defeating dedup.
  const pending = inflight.get(memoryKey)
  if (pending) return pending as Promise<T>

  const redisKey = `${CACHE_PREFIX}${key.surface}:${hash}`

  const p = (async () => {
    try {
      // Layer 2 — inside the inflight promise so concurrent callers share
      // the Redis lookup as well.
      if (ttl > 0) {
        const redis = getRedis()
        if (redis) {
          try {
            const hit = await redis.get<T>(redisKey)
            if (hit !== null && hit !== undefined) return hit
          } catch (e) {
            logger.warn('llm-cache read failed, falling through', {
              service: 'llm-cache',
              surface: key.surface,
              err: e instanceof Error ? e.message : 'unknown',
            })
          }
        }
      }

      const result = await call()

      if (ttl > 0) {
        const shouldCache = options?.shouldCache
          ? options.shouldCache(result)
          : isNonEmptyResult(result)
        if (shouldCache) {
          const redis = getRedis()
          if (redis) {
            try {
              await redis.set(redisKey, result, { ex: ttl })
            } catch (e) {
              logger.warn('llm-cache write failed', {
                service: 'llm-cache',
                surface: key.surface,
                err: e instanceof Error ? e.message : 'unknown',
              })
            }
          }
        }
      }

      return result
    } finally {
      inflight.delete(memoryKey)
    }
  })()

  inflight.set(memoryKey, p)
  return p
}

/** Test hook — drops the in-process coalescing map. */
export function __resetLlmCacheForTests(): void {
  inflight.clear()
  redisClient = undefined
}
