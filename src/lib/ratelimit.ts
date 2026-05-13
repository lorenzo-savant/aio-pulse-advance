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
import * as Sentry from '@sentry/nextjs'
import { logger } from '@/lib/logger'

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

// Sweep expired entries every 5 minutes — only in dev (in-memory store)
// In production serverless, each invocation gets a fresh process anyway.
if (typeof setInterval !== 'undefined' && process.env.NODE_ENV !== 'production') {
  const _sweepInterval = setInterval(
    () => {
      const now = Date.now()
      for (const [k, v] of _store) {
        if (v.resetAt < now) _store.delete(k)
      }
    },
    5 * 60 * 1000,
  )
  // Prevent keeping the process alive in test environments
  if (typeof _sweepInterval === 'object' && 'unref' in _sweepInterval) {
    _sweepInterval.unref()
  }
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
      logger.error('[rate-limit] Redis error', { err: error })
      return { success: false, remaining: 0, resetAt: Date.now() + windowMs }
    }
  }

  // ── No Redis configured ──────────────────────────────────────────────────
  // In-memory Map doesn't work on serverless (Vercel) where each invocation
  // is a separate container. **Fail closed in production** to avoid API cost
  // runaway during a Redis outage or misconfiguration. Configure Upstash to
  // restore service.
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    logger.error('[rate-limit] Redis not configured in production — failing closed')
    // Notify ops via Sentry (no-op if Sentry not initialized)
    Sentry.captureMessage('Rate limit: Redis not configured in production', 'error')
    return { success: false, remaining: 0, resetAt: Date.now() + windowMs }
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
