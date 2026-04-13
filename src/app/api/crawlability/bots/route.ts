import { NextResponse } from 'next/server'
import { checkCrawlability, AI_BOTS, type BotName } from '@/lib/services/crawlability'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
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
