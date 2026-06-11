import { type NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'

/**
 * Constant-time verification of the `Authorization: Bearer <secret>` header
 * used to authenticate Vercel cron invocations.
 *
 * Vercel automatically injects `Authorization: Bearer <CRON_SECRET>` into cron
 * requests, but ONLY when the env var is named exactly `CRON_SECRET`. This app
 * historically standardised on `CRON_SECRET_TOKEN`, which forced operators to
 * set BOTH vars to the same value by hand (see DEPLOYMENT_HANDOFF_2026-05-29).
 * That dual-var sync is a footgun: rotating one and forgetting the other
 * silently 401s every cron. We remove it by accepting EITHER name.
 *
 * Returns a ready 401/500 NextResponse on failure, or null when authorized.
 * Hashing both sides equalizes length so timingSafeEqual never throws and
 * leaks no length information.
 */
export function verifyCronAuth(req: NextRequest): NextResponse | null {
  // Accept Vercel's native `CRON_SECRET` and the app's legacy
  // `CRON_SECRET_TOKEN`. Either one being set and matching authorizes the call.
  const secrets = [process.env.CRON_SECRET, process.env.CRON_SECRET_TOKEN].filter(
    (s): s is string => typeof s === 'string' && s.length > 0,
  )

  if (secrets.length === 0) {
    return NextResponse.json({ success: false, message: 'Server misconfigured' }, { status: 500 })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const provided = createHash('sha256').update(authHeader).digest()

  // Compare against every configured secret in constant time. OR the results
  // WITHOUT early-exit so we leak neither which secret matched nor any length
  // information (both digests are a fixed 32 bytes).
  let authorized = false
  for (const secret of secrets) {
    const expected = createHash('sha256').update(`Bearer ${secret}`).digest()
    if (timingSafeEqual(provided, expected)) {
      authorized = true
    }
  }

  if (!authorized) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }
  return null
}
