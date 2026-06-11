import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

// Browsers control this payload shape and field presence varies across engines,
// so every inner field is optional — we only require the `csp-report` envelope.
const cspReportSchema = z.object({
  'csp-report': z.object({
    'blocked-uri': z.string().optional(),
    'document-uri': z.string().optional(),
    referrer: z.string().optional(),
    'violated-directive': z.string().optional(),
    'effective-directive': z.string().optional(),
    'original-policy': z.string().optional(),
  }),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = cspReportSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: 'Invalid CSP report' }, { status: 400 })
    }
    const cspReport = parsed.data['csp-report']

    const logEntry = {
      type: 'csp_violation',
      blocked_uri: cspReport['blocked-uri'],
      document_uri: cspReport['document-uri'],
      violated_directive: cspReport['violated-directive'],
      effective_directive: cspReport['effective-directive'],
      referrer: cspReport['referrer'],
      timestamp: new Date().toISOString(),
      user_agent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
    }

    logger.warn('CSP violation detected', logEntry)

    const db = createServerClient()
    if (db) {
      try {
        await db.from('security_logs').insert({
          event_type: 'csp_violation',
          event_data: logEntry,
          severity: 'warning',
        })
      } catch {
        // Silently fail if table doesn't exist
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('CSP reporting error', { error })
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'CSP Report endpoint. Send POST with CSP violation reports.',
    documentation: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP',
  })
}
