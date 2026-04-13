import { type NextRequest, NextResponse } from 'next/server'
import { verifyWebhook } from '@/lib/services/public-api'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { payload, signature, secret } = body as {
    payload?: string
    signature?: string
    secret?: string
  }

  if (!payload || !signature || !secret) {
    return NextResponse.json(
      { success: false, error: 'Missing payload, signature, or secret' },
      { status: 400 },
    )
  }

  const isValid = verifyWebhook(payload, signature, secret)

  return NextResponse.json({
    success: true,
    data: { valid: isValid },
    timestamp: Date.now(),
  })
}
