import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { auditSite, auditArticle } from '@/lib/audit/site-audit'
import { requireUser, rateLimitGate, isValidHttpUrl } from '@/lib/api-auth'
import { SsrfError } from '@/lib/utils/safe-fetch'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  const limited = await rateLimitGate(req, 'audit', 10)
  if (limited) return limited

  try {
    const body = await req.json()
    const { url, type = 'site' } = body

    if (!isValidHttpUrl(url)) {
      return NextResponse.json({ error: 'A valid http(s) URL is required' }, { status: 400 })
    }

    const result = type === 'article' ? await auditArticle(url) : await auditSite(url)
    return NextResponse.json({ audit: result })
  } catch (err) {
    if (err instanceof SsrfError) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 })
    }
    logger.error('Audit API error', { err })
    return NextResponse.json({ error: 'Audit failed' }, { status: 500 })
  }
}
