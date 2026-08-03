import { NextResponse } from 'next/server'
import { checkCrawlability } from '@/lib/services/crawlability'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'

// Public no-auth endpoint (compact sibling of /api/crawlability/check).
// nodejs runtime, not edge: the SSRF guard inside checkCrawlability imports
// dns/promises, which rejects on the edge runtime.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // Same IP-based limit as /api/crawlability/check — this variant was
  // shipped without one and could be hammered anonymously.
  const ip = getClientIp({
    get: (k) => request.headers.get(k) || null,
  })
  const rate = await checkRateLimit(`crawlability-bots:${ip}`, 30, 60_000)
  if (!rate.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please retry in a minute.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': String(rate.remaining),
          'X-RateLimit-Reset': String(rate.resetAt),
        },
      },
    )
  }

  try {
    const result = await checkCrawlability(url)
    const bots = result.results.map((r) => ({
      name: r.bot,
      allowed: r.allowed,
    }))
    return NextResponse.json({
      url: result.url,
      timestamp: result.timestamp,
      bots,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Check failed' },
      { status: 500 },
    )
  }
}
