import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { checkFreshness } from '@/lib/audit/generators'
import { requireUser, rateLimitGate, isValidHttpUrl } from '@/lib/api-auth'
import { SsrfError } from '@/lib/utils/safe-fetch'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  const limited = await rateLimitGate(req, 'audit-freshness', 10)
  if (limited) return limited

  try {
    const body = await req.json()
    const { url } = body

    if (!isValidHttpUrl(url)) {
      return NextResponse.json({ error: 'A valid http(s) URL is required' }, { status: 400 })
    }

    const result = await checkFreshness(url)
    return NextResponse.json({ freshness: result })
  } catch (err) {
    if (err instanceof SsrfError) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 })
    }
    logger.error('Freshness check error', { err })
    return NextResponse.json({ error: 'Freshness check failed' }, { status: 500 })
  }
}
