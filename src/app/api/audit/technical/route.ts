import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { runTechnicalAudit } from '@/lib/services/technical-seo-audit'
import { logger } from '@/lib/logger'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/ratelimit'
import type { Json } from '@/types/database'
import { formatValidationError } from '@/lib/format-validation-error'

const auditRequestSchema = z.object({
  url: z.preprocess(
    (v) => (typeof v === 'string' && v.length > 0 && !/^https?:\/\//i.test(v) ? `https://${v}` : v),
    z.string().url(),
  ),
  brandId: z.string().uuid().optional(),
})

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// Rate limiting uses the shared Upstash-backed limiter (fail-closed in
// production). This route used to carry a private DB-backed limiter on the
// rate_limits table: non-atomic (SELECT→UPDATE lost updates under
// concurrency), fail-OPEN on every error path — the exact inverse of the
// shared policy — and 2-3 extra DB round-trips per request.

export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const rl = await checkRateLimit(`audit:${userId}`, 5, 60_000)
  if (!rl.success) {
    return NextResponse.json(
      {
        success: false,
        message: `Rate limit exceeded. Try again in ${Math.ceil((rl.resetAt - Date.now()) / 1000)}s.`,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rl.resetAt),
          'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = auditRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: formatValidationError(parsed.error),
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    )
  }

  const { url, brandId } = parsed.data

  // Check cache first
  const db = createServerClient()
  if (db) {
    try {
      const { data: cached } = await db
        .from('seo_audit_results')
        .select('results, overall_score, cached_at')
        .eq('url', url)
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('cached_at', { ascending: false })
        .limit(1)
        .single()

      if (cached) {
        return NextResponse.json(
          {
            success: true,
            data: cached.results,
            cached: true,
            cachedAt: cached.cached_at,
          },
          {
            headers: {
              'X-RateLimit-Limit': '5',
              'X-RateLimit-Remaining': String(rl.remaining),
              'X-RateLimit-Reset': String(rl.resetAt),
            },
          },
        )
      }
    } catch {
      // Cache miss — proceed with fresh audit
    }
  }

  try {
    const result = await runTechnicalAudit(url)

    // Persist result to cache
    if (db) {
      try {
        const now = new Date()
        const expiresAt = new Date(now.getTime() + CACHE_TTL_MS)
        await db.from('seo_audit_results').insert({
          brand_id: brandId || null,
          user_id: userId,
          url,
          overall_score: result.overallScore ?? 0,
          results: result as unknown as Json,
          cached_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        })
      } catch (dbErr) {
        logger.error('Failed to cache result', { source: 'audit/technical', error: String(dbErr) })
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: result,
        cached: false,
      },
      {
        headers: {
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': String(rl.remaining),
          'X-RateLimit-Reset': String(rl.resetAt),
        },
      },
    )
  } catch (error: unknown) {
    logger.error('Audit error', { source: 'audit/technical', error: String(error) })
    const message = error instanceof Error ? error.message : 'Audit failed'
    return NextResponse.json(
      { success: false, message: `Unable to reach URL: ${message}` },
      { status: 500 },
    )
  }
}
