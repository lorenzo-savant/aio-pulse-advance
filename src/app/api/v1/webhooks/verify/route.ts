import { type NextRequest, NextResponse } from 'next/server'
import { verifyWebhook } from '@/lib/services/public-api'
import { webhookVerifySchema, firstZodMessage } from '@/lib/validations'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = webhookVerifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: firstZodMessage(parsed.error, 'Missing payload, signature, or secret'),
      },
      { status: 400 },
    )
  }
  const { payload, signature, secret } = parsed.data

  const isValid = verifyWebhook(payload, signature, secret)

  return NextResponse.json({
    success: true,
    data: { valid: isValid },
    timestamp: Date.now(),
  })
}
