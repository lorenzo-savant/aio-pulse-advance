// PATH: src/lib/ratelimit.ts
//
// ─── Rate Limiting ────────────────────────────────────────────────────────────
//
// Two modes:
//
//   DEVELOPMENT / no Redis:
//     Uses an in-process Map — works fine locally, resets on restart.
//
//   PRODUCTION (Vercel / serverless):
//     Uses Upstash Redis for distributed rate limiting.
//     Install dependencies:
//       npm install @upstash/ratelimit @upstash/redis
//     Add to .env.local:
//       UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
//       UPSTASH_REDIS_REST_TOKEN=AXxxxx
//     Free tier: 10 000 requests/day — sufficient for most SaaS projects.
//
// ─────────────────────────────────────────────────────────────────────────────

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export interface RateLimitResult {
  /** true = request is allowed, false = limit exceeded */
  success: boolean
  /** how many requests are still allowed in this window */
  remaining: number
  /** timestamp (ms) when the window resets */
  resetAt: number
}

// ─── Redis client (lazy initialized) ────────────────────────────────────────

let redisClient: Redis | null = null
let redisRatelimit: Ratelimit | null = null

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient

  const url = process.env['UPSTASH_REDIS_REST_URL']
  const token = process.env['UPSTASH_REDIS_REST_TOKEN']

  if (url && token) {
    redisClient = new Redis({
      url,
      token,
    })
    return redisClient
  }

  return null
}

function getRatelimit(limit: number, windowMs: number): Ratelimit | null {
  if (redisRatelimit) return redisRatelimit

  const redis = getRedisClient()
  if (!redis) return null

  redisRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowMs}ms`),
    analytics: true,
    prefix: 'aio-pulse:rl',
  })

  return redisRatelimit
}

// ─── In-memory store (dev / fallback) ─────────────────────────────────────────

interface MemEntry {
  count: number
  resetAt: number
}

const _store = new Map<string, MemEntry>()

// Sweep expired entries every 5 minutes so the Map doesn't grow forever
if (typeof setInterval !== 'undefined') {
  setInterval(
    () => {
      const now = Date.now()
      for (const [k, v] of _store) {
        if (v.resetAt < now) _store.delete(k)
      }
    },
    5 * 60 * 1000,
  )
}

// ─── checkRateLimit ───────────────────────────────────────────────────────────
//
// Parameters
//   identifier  unique key per client — use IP or userId
//   limit       max requests allowed per window (default 20)
//   windowMs    window size in milliseconds (default 60 000 = 1 min)
//
// Returns RateLimitResult
//
export async function checkRateLimit(
  identifier: string,
  limit = 20,
  windowMs = 60_000,
): Promise<RateLimitResult> {
  // ── Redis production mode ─────────────────────────────────────────────────
  const ratelimit = getRatelimit(limit, windowMs)

  if (ratelimit) {
    try {
      const { success, remaining, reset } = await ratelimit.limit(identifier)
      return { success, remaining, resetAt: reset }
    } catch (error) {
      console.error('[rate-limit] Redis error:', error)
      return { success: false, remaining: 0, resetAt: Date.now() + windowMs }
    }
  }

  // ── No Redis configured ──────────────────────────────────────────────────
  // In-memory Map doesn't work on serverless (Vercel) where each invocation
  // is a separate container. Fail closed in production.
  if (process.env.NODE_ENV === 'production') {
    console.error('[rate-limit] Redis not configured in production - rate limiting disabled')
    // Allow requests but log the issue
    return { success: true, remaining: 0, resetAt: Date.now() + windowMs }
  }

  // ── In-memory fallback (dev mode only) ──────────────────────────────────
  const now = Date.now()
  const existing = _store.get(identifier)

  if (!existing || existing.resetAt < now) {
    const resetAt = now + windowMs
    _store.set(identifier, { count: 1, resetAt })
    return { success: true, remaining: limit - 1, resetAt }
  }

  if (existing.count >= limit) {
    return { success: false, remaining: 0, resetAt: existing.resetAt }
  }

  existing.count++
  return {
    success: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
  }
}

// ─── getClientIp ─────────────────────────────────────────────────────────────
// Extracts real client IP from Next.js request headers.
// Handles Vercel, Cloudflare, and direct connections.
export function getClientIp(headers: { get: (key: string) => string | null }): string {
  return (
    headers.get('x-real-ip') ??
    headers.get('cf-connecting-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}
