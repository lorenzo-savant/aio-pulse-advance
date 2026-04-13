import { NextRequest, NextResponse } from 'next/server'
import { validateHtml } from '@/lib/services/schema-validator'

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
        'User-Agent': 'Mozilla/5.0 (compatible; AIO-Pulse-SchemaValidator/1.0)',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.status} ${response.statusText}` },
        { status: response.status },
      )
    }

    const html = await response.text()
    const result = await validateHtml(html, url)

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error: `Error validating schema: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 },
    )
  }
}
