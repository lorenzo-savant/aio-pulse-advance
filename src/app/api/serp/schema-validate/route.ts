import { NextRequest, NextResponse } from 'next/server'
import { validateHtml } from '@/lib/services/schema-validator'
import { requireUser } from '@/lib/api-auth'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { safeFetchText, SsrfError } from '@/lib/utils/safe-fetch'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (auth instanceof NextResponse) return auth

  const ip = getClientIp(request.headers)
  const rateCheck = await checkRateLimit(`schema-validate:${ip}`, 10, 60_000)
  if (!rateCheck.success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
      },
    )
  }

  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing required parameter: url' }, { status: 400 })
  }

  try {
    const { text: html, response } = await safeFetchText(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIO-Pulse-SchemaValidator/1.0)' },
      timeout: 15000,
      maxBytes: 5 * 1024 * 1024,
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.status}` },
        { status: 502 },
      )
    }

    const result = await validateHtml(html, url)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof SsrfError) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 })
    }
    logger.error('schema-validate failed', { err: error })
    return NextResponse.json({ error: 'Error validating schema' }, { status: 500 })
  }
}
