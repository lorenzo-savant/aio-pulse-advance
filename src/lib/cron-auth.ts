import { type NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'

/**
 * Constant-time verification of the `Authorization: Bearer <CRON_SECRET_TOKEN>`
 * header used to authenticate Vercel cron invocations.
 *
 * Returns a ready 401/500 NextResponse on failure, or null when authorized.
 * Hashing both sides equalizes length so timingSafeEqual never throws and
 * leaks no length information.
 */
export function verifyCronAuth(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET_TOKEN
  if (!cronSecret) {
    return NextResponse.json({ success: false, message: 'Server misconfigured' }, { status: 500 })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${cronSecret}`

  const a = createHash('sha256').update(authHeader).digest()
  const b = createHash('sha256').update(expected).digest()

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }
  return null
}
