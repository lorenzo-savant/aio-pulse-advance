import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

interface CSPReport {
  'csp-report'?: {
    'blocked-uri': string
    'document-uri': string
    referrer: string
    'violated-directive': string
    'effective-directive': string
    'original-policy': string
  }
}

export async function POST(req: NextRequest) {
  try {
    const report: CSPReport = await req.json()
    const cspReport = report['csp-report']

    if (!cspReport) {
      return NextResponse.json({ success: false, message: 'Invalid CSP report' }, { status: 400 })
    }

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

    console.warn('[CSP VIOLATION]', JSON.stringify(logEntry))

    const db = createServerClient()
    if (db) {
      try {
        await (db as any).from('security_logs').insert({
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
    console.error('[CSP Reporting Error]', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'CSP Report endpoint. Send POST with CSP violation reports.',
    documentation: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP',
  })
}
