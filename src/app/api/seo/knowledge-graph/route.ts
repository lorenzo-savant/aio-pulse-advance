import { NextRequest, NextResponse } from 'next/server'
import { analyzeKnowledgeGraph } from '@/lib/services/knowledge-graph'

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
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing required parameter: url' }, { status: 400 })
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AIO-Pulse-KnowledgeGraph/1.0)',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.status} ${response.statusText}` },
        { status: response.status },
      )
    }

    const html = await response.text()
    const jsonLd = extractJsonLd(html)
    const result = analyzeKnowledgeGraph(html, jsonLd)

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error: `Error analyzing knowledge graph: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 },
    )
  }
}
