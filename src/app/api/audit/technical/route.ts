import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { runTechnicalAudit } from '@/lib/services/technical-seo-audit'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'

const auditRequestSchema = z.object({
  url: z.string().url(),
})

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

  const { url } = parsed.data

  try {
    const result = await runTechnicalAudit(url)

    return NextResponse.json(
      {
        success: true,
        data: result,
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
