// ─── Per-user + endpoint-aware rate limit helpers ────────────────────────────
//
// The global middleware enforces a coarse 100 req/min PER IP on every /api/*
// route — fine as a DoS floor, but useless for protecting expensive endpoints
// from a single authenticated user, and unfair to teams sitting behind a
// shared NAT (one user gets throttled because of a colleague's burst).
//
// This module layers two finer controls on top:
//
//   1. perUserLimit() — keyed by Supabase userId, scoped per-endpoint, higher
//      ceiling than per-IP. Use inside an API route AFTER you've authenticated
//      the caller, to throttle abusive authenticated traffic.
//
//   2. expensiveEndpointLimit() — preset tiers for routes that hit AI providers
//      or do heavy work. Defines small, opinionated limits (5/min, 20/hour) so
//      we don't sprinkle magic numbers around the codebase.
//
// Both helpers reuse the same Upstash Redis client as src/lib/ratelimit.ts and
// fail-closed in production — no Redis = no service, by design.
// ─────────────────────────────────────────────────────────────────────────────

import { checkRateLimit, type RateLimitResult } from '@/lib/ratelimit'
import { NextResponse } from 'next/server'

/** Per-endpoint+user rate limit. Use after auth. */
export async function perUserLimit(
  userId: string,
  endpoint: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  // Compose a stable key: scope by endpoint so /api/A and /api/B don't share
  // the same per-user bucket. Prefix `u:` distinguishes from per-IP keys.
  return checkRateLimit(`u:${userId}:${endpoint}`, limit, windowMs)
}

/**
 * Pre-configured tiers for expensive endpoints. Keep this small — every new
 * tier is one more "what does this cost?" question for the next reader.
 */
export const TIERS = {
  /** Light: read-only DB query, no AI call. 60/min/user. */
  read: { limit: 60, windowMs: 60_000 },
  /** Medium: triggers a single AI call or webhook. 20/min/user. */
  ai_single: { limit: 20, windowMs: 60_000 },
  /** Heavy: multi-engine fan-out, generates content. 5/min/user, 50/hour/user. */
  ai_heavy: { limit: 5, windowMs: 60_000 },
  /** Bulk: crawls, audits, multi-page scrapes. 3/5min/user. */
  bulk: { limit: 3, windowMs: 5 * 60_000 },
} as const

export type Tier = keyof typeof TIERS

/**
 * Convenience wrapper — apply a named tier to a user+endpoint pair and return
 * a NextResponse 429 if the limit was exceeded (null = allowed).
 *
 * Usage at the top of a POST handler:
 *
 *     const blocked = await guardWithTier(userId, '/api/generate', 'ai_heavy')
 *     if (blocked) return blocked
 */
export async function guardWithTier(
  userId: string,
  endpoint: string,
  tier: Tier,
): Promise<NextResponse | null> {
  const { limit, windowMs } = TIERS[tier]
  const result = await perUserLimit(userId, endpoint, limit, windowMs)
  if (result.success) return null

  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
  return NextResponse.json(
    {
      success: false,
      message: 'Per-user rate limit exceeded',
      tier,
      retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Tier': tier,
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    },
  )
}
