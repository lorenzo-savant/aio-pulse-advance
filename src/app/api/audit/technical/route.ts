import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { runTechnicalAudit } from '@/lib/services/technical-seo-audit'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'

const auditRequestSchema = z.object({
  url: z.string().url(),
  brandId: z.string().uuid().optional(),
})

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

async function checkRateLimit(
  key: string,
  limit: number,
  windowSecs: number,
): Promise<{
  success: boolean
  remaining: number
  resetAt: number
}> {
  const db = createServerClient()
  if (!db) return { success: true, remaining: limit, resetAt: Date.now() + windowSecs * 1000 }

  try {
    const now = Date.now()
    const windowMs = windowSecs * 1000
    const windowStart = now - windowMs

    const { data, error } = await (db as any)
      .from('rate_limits')
      .select('count, last_request')
      .eq('key', key)
      .single()

    if (error && error.code !== 'PGRST116') {
      return { success: true, remaining: limit, resetAt: now + windowMs }
    }

    if (!data || data.last_request < windowStart) {
      await (db as any).from('rate_limits').upsert(
        {
          key,
          count: 1,
          last_request: now,
        },
        { onConflict: 'key' },
      )

      return { success: true, remaining: limit - 1, resetAt: now + windowMs }
    }

    if (data.count >= limit) {
      return { success: false, remaining: 0, resetAt: data.last_request + windowMs }
    }

    await (db as any)
      .from('rate_limits')
      .update({ count: data.count + 1, last_request: now })
      .eq('key', key)

    return { success: true, remaining: limit - data.count - 1, resetAt: now + windowSecs * 1000 }
  } catch {
    return { success: true, remaining: limit, resetAt: Date.now() + windowSecs * 1000 }
  }
}

export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const rl = await checkRateLimit(`audit:${userId}`, 5, 60)
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
        message: 'Validation failed',
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
      const { data: cached } = await (db as any)
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
        await (db as any).from('seo_audit_results').insert({
          brand_id: brandId || null,
          user_id: userId,
          url,
          overall_score: result.overallScore ?? 0,
          results: result,
          cached_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        })
      } catch (dbErr) {
        console.error('[/api/audit/technical] Failed to cache result:', dbErr)
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
    console.error('[/api/audit/technical] Error:', error)
    const message = error instanceof Error ? error.message : 'Audit failed'
    return NextResponse.json(
      { success: false, message: `Unable to reach URL: ${message}` },
      { status: 500 },
    )
  }
}
