import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { generateLlmstxt } from '@/lib/audit/generators'
import { requireUser, rateLimitGate, isValidHttpUrl } from '@/lib/api-auth'
import { SsrfError } from '@/lib/utils/safe-fetch'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  const limited = await rateLimitGate(req, 'audit-llmstxt', 10)
  if (limited) return limited

  try {
    const body = await req.json()
    const { url, includePaths, excludePaths, maxUrls } = body

    if (!isValidHttpUrl(url)) {
      return NextResponse.json({ error: 'A valid http(s) URL is required' }, { status: 400 })
    }

    const llmstxt = await generateLlmstxt({
      siteUrl: url,
      includePaths: Array.isArray(includePaths) ? includePaths.slice(0, 100) : [],
      excludePaths: Array.isArray(excludePaths) ? excludePaths.slice(0, 100) : [],
      maxUrls: typeof maxUrls === 'number' ? maxUrls : 200,
    })

    return NextResponse.json({ llmstxt })
  } catch (err) {
    if (err instanceof SsrfError) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 })
    }
    logger.error('llms.txt generation error', { err })
    return NextResponse.json({ error: 'llms.txt generation failed' }, { status: 500 })
  }
}
