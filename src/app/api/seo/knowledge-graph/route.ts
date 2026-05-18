import { NextRequest, NextResponse } from 'next/server'
import { analyzeKnowledgeGraph } from '@/lib/services/knowledge-graph'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { requireUser } from '@/lib/api-auth'
import { safeFetchText, SsrfError } from '@/lib/utils/safe-fetch'
import { logger } from '@/lib/logger'

function extractJsonLd(html: string): object[] {
  const jsonLdScripts =
    html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  const results: object[] = []

  for (const script of jsonLdScripts) {
    const match = script.match(/>([\s\S]*?)</)
    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1])
        if (Array.isArray(parsed)) {
          results.push(...parsed)
        } else {
          results.push(parsed)
        }
      } catch {
        // Skip invalid JSON
      }
    }
  }

  return results
}

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (auth instanceof NextResponse) return auth

  const ip = getClientIp(request.headers)
  const rateCheck = await checkRateLimit(`knowledge-graph:${ip}`, 10, 60_000)
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
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIO-Pulse-KnowledgeGraph/1.0)' },
      timeout: 15000,
      maxBytes: 5 * 1024 * 1024,
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.status}` },
        { status: 502 },
      )
    }

    const jsonLd = extractJsonLd(html)
    const result = analyzeKnowledgeGraph(html, jsonLd)

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof SsrfError) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 })
    }
    logger.error('knowledge-graph failed', { err: error })
    return NextResponse.json({ error: 'Error analyzing knowledge graph' }, { status: 500 })
  }
}
