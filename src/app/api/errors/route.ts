import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { logger } from '@/lib/logger'

interface ClientErrorEvent {
  name: string
  message: string
  stack?: string
  timestamp: string
  url: string
  userAgent: string
  userId?: string
  brandId?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  tags?: Record<string, string>
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req.headers)
  const { success } = await checkRateLimit(`error:${clientIp}`, 10, 60_000)

  if (!success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Max 10 requests per minute.' },
      { status: 429 },
    )
  }

  try {
    const event: ClientErrorEvent = await req.json()

    if (!event.name || !event.message) {
      return NextResponse.json({ success: false, message: 'Invalid error event' }, { status: 400 })
    }

    // ── M-6: this is an UNAUTHENTICATED client beacon. Treat all body fields
    // as hostile to prevent log / observability poisoning.
    const UUID_RE = /^[0-9a-fA-F-]{36}$/
    const truncate = (v: unknown, max: number): string => String(v ?? '').slice(0, max)

    // Cap/sanitize free-text fields.
    const safeName = truncate(event.name, 500)
    const safeMessage = truncate(event.message, 2000)
    const safeStack = event.stack != null ? truncate(event.stack, 8000) : undefined
    const safeUrl = truncate(event.url, 2000)

    // Do not trust client-supplied identifiers unless they look like UUIDs.
    const safeUserId =
      typeof event.userId === 'string' && UUID_RE.test(event.userId) ? event.userId : null
    const safeBrandId =
      typeof event.brandId === 'string' && UUID_RE.test(event.brandId) ? event.brandId : null

    // Cap tags to an object/array with at most ~20 entries; drop otherwise.
    let safeTags: ClientErrorEvent['tags'] | undefined
    if (event.tags && typeof event.tags === 'object') {
      const entries = Object.entries(event.tags as Record<string, unknown>)
      if (entries.length <= 20) {
        safeTags = Object.fromEntries(
          entries.map(([k, val]) => [truncate(k, 200), truncate(val, 500)]),
        )
      }
    }

    const logEntry = {
      event_type: 'client_error',
      user_id: safeUserId,
      brand_id: safeBrandId,
      ip_address: clientIp,
      user_agent: truncate(event.userAgent, 500),
      event_data: {
        name: safeName,
        message: safeMessage,
        stack: safeStack,
        url: safeUrl,
        severity: event.severity,
        tags: safeTags,
      },
      severity: event.severity,
    }

    logger.error('Client error', { source: 'errors', ...logEntry })

    const db = createServerClient()
    if (db) {
      try {
        await db.from('security_logs').insert(logEntry)
      } catch {
        // Silently fail if table doesn't exist
      }
    }

    if (event.severity === 'critical' || event.severity === 'high') {
      logger.error('Critical client error', {
        source: 'errors',
        name: safeName,
        message: safeMessage,
        severity: event.severity,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error logging failed', { source: 'errors', error: String(error) })
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Error reporting endpoint',
    usage: 'POST with error event object',
  })
}
