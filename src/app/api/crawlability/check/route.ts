import { NextResponse } from 'next/server'
import { checkCrawlability, AI_BOTS, type BotName } from '@/lib/services/crawlability'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'

// Public no-auth endpoint — useful as a free pre-signup "check your AI crawlability"
// lead magnet. IP-based rate limit prevents abuse (e.g., crawling many URLs through
// the service). 30 requests / 60 seconds is a generous limit for legitimate use.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // IP-based rate limit (CF audit Area H — no-auth endpoint hardening)
  const ip = getClientIp({
    get: (k) => request.headers.get(k) || null,
  })
  const rate = await checkRateLimit(`crawlability-check:${ip}`, 30, 60_000)
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
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Check failed' },
      { status: 500 },
    )
  }
}
