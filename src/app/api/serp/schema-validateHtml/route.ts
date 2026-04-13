import { NextRequest, NextResponse } from 'next/server'
import { validateHtml } from '@/lib/services/schema-validator'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { html, url } = body

    if (!html) {
      return NextResponse.json({ error: 'Missing required field: html' }, { status: 400 })
    }

    const result = await validateHtml(html, url)

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    return NextResponse.json(
      {
        error: `Error validating schema: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 },
    )
  }
}
