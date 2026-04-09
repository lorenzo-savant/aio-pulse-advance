import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    Sentry.captureException(new Error(body.message || 'Client error'), {
      extra: body.data,
      tags: {
        source: 'client-error',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Invalid request' }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
