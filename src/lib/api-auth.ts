import { type NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId, AuthError } from '@/lib/supabase'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'

/**
 * Shared authentication gate for API route handlers.
 *
 * Middleware only protects /dashboard pages — every /api/* handler must
 * enforce auth itself. Use this at the top of every handler that touches
 * tenant data:
 *
 *   const auth = await requireUser(req)
 *   if (auth instanceof NextResponse) return auth
 *   const { userId } = auth
 *
 * Returns the resolved userId, or a ready-to-return NextResponse with the
 * correct status (401/503) and the standard `{ success, message }` envelope.
 */
export async function requireUser(req: NextRequest): Promise<{ userId: string } | NextResponse> {
  try {
    const userId = await getCurrentUserId(
      req.headers.get('authorization'),
      req.headers.get('cookie'),
      req,
    )
    return { userId }
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ success: false, message: e.message }, { status: e.statusCode })
    }
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 401 })
  }
}

/**
 * Per-IP rate-limit gate. Returns a 429 NextResponse if the limit is hit,
 * otherwise null. Use for unauthenticated or expensive endpoints.
 */
export async function rateLimitGate(
  req: NextRequest,
  bucket: string,
  limit: number,
  windowMs = 60_000,
): Promise<NextResponse | null> {
  const ip = getClientIp(req.headers)
  const { success, resetAt } = await checkRateLimit(`${bucket}:${ip}`, limit, windowMs)
  if (success) return null
  return NextResponse.json(
    { success: false, message: 'Rate limit exceeded. Try again later.' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)) },
    },
  )
}

/**
 * Validate a user-supplied URL string: must be a well-formed http(s) URL.
 * SSRF (private-IP/redirect) defense is enforced separately by safeFetch.
 */
export function isValidHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return false
  try {
    const u = new URL(value.includes('://') ? value : `https://${value}`)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
