import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'

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

    const logEntry = {
      event_type: 'client_error',
      user_id: event.userId,
      brand_id: event.brandId,
      ip_address:
        req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('cf-connecting-ip'),
      user_agent: event.userAgent,
      event_data: {
        name: event.name,
        message: event.message,
        stack: event.stack,
        url: event.url,
        severity: event.severity,
        tags: event.tags,
      },
      severity: event.severity,
    }

    console.error('[CLIENT ERROR]', JSON.stringify(logEntry))

    const db = createServerClient()
    if (db) {
      try {
        await (db as any).from('security_logs').insert(logEntry)
      } catch {
        // Silently fail if table doesn't exist
      }
    }

    if (event.severity === 'critical' || event.severity === 'high') {
      console.error('[CRITICAL ERROR]', event)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Error logging failed]', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Error reporting endpoint',
    usage: 'POST with error event object',
  })
}
