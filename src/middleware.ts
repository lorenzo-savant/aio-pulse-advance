import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'

export function safeRedirect(url: string, fallback = '/dashboard'): string {
  if (
    url &&
    url.startsWith('/') &&
    !url.startsWith('//') &&
    !url.includes('://') &&
    !url.includes('\\') &&
    !url.includes('\0') &&
    !url.includes('%00')
  ) {
    // Normalize and ensure it still starts with /
    try {
      const parsed = new URL(url, 'http://localhost')
      if (parsed.pathname.startsWith('/')) return parsed.pathname + parsed.search
    } catch {
      // Malformed URL
    }
  }
  return fallback
}

/**
 * Generate a nonce-based Content-Security-Policy header value.
 * The nonce replaces 'unsafe-inline' for script-src in modern browsers.
 * 'unsafe-inline' is kept as a fallback for older browsers — it is ignored
 * when a nonce or hash is present (per CSP Level 2+).
 */
export function buildCspHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://va.vercel-scripts.com${isDev ? " 'unsafe-eval'" : ''}`,
    // 'unsafe-inline' is retained for style-src because Tailwind (and Next.js
    // critical-CSS inlining) inject inline <style>/style attributes at runtime;
    // a nonce/hash cannot cover them without breaking styling. Scripts remain
    // nonce-locked above, so this does not weaken script-injection defenses.
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://*.supabase.co https://*.vercel.com https://*.vercel.app https://vitals.vercel-insights.com https://api.openai.com https://generativelanguage.googleapis.com https://api.perplexity.ai https://api.anthropic.com",
    "img-src 'self' data: https://*.supabase.co https://*.vercel.app",
    "font-src 'self' data:",
    "frame-ancestors 'none'",
  ].join('; ')
}

/** Set the CSP and x-nonce headers on a response. */
function applyCspHeaders(response: NextResponse, nonce: string): NextResponse {
  response.headers.set('Content-Security-Policy', buildCspHeader(nonce))
  response.headers.set('x-nonce', nonce)
  return response
}

/**
 * Paths where the URL itself carries a secret (invitation tokens, magic links,
 * etc.) — we lock the Referrer-Policy down so the secret never leaks via the
 * Referer header when the user clicks a third-party link on the landed page.
 */
const TOKEN_BEARING_PATHS = ['/team/accept', '/auth/confirm', '/auth/reset-password']
function isTokenBearingPath(pathname: string): boolean {
  return TOKEN_BEARING_PATHS.some((p) => pathname.startsWith(p))
}

const protectedRoutes = ['/dashboard']
const authRoutes = ['/auth/login', '/auth/register']
const publicApiRoutes: string[] = []

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Generate a nonce per request for CSP (Edge-compatible Web Crypto API)
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  // Pass nonce to Server Components via request header
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  if (isTokenBearingPath(pathname)) {
    supabaseResponse.headers.set('Referrer-Policy', 'no-referrer')
  }

  if (pathname.startsWith('/api/')) {
    const identifier = getClientIp(request.headers)
    const { success, remaining, resetAt } = await checkRateLimit(identifier, 100, 60_000)

    if (!success) {
      const rateLimitResponse = NextResponse.json(
        {
          success: false,
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)) },
        },
      )
      return applyCspHeaders(rateLimitResponse, nonce)
    }

    supabaseResponse.headers.set('X-RateLimit-Limit', '100')
    supabaseResponse.headers.set('X-RateLimit-Remaining', String(remaining))
    supabaseResponse.headers.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const fallbackResponse = NextResponse.next({ request: { headers: requestHeaders } })
    return applyCspHeaders(fallbackResponse, nonce)
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, { path: '/', ...options })
          })
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(route),
  )
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route))
  const isPublicApiRoute = publicApiRoutes.some((route) => pathname.startsWith(route))

  if (isPublicApiRoute) {
    return applyCspHeaders(supabaseResponse, nonce)
  }

  if (!user && isProtectedRoute) {
    const url = new URL('/auth/login', request.url)
    url.searchParams.set('redirect', safeRedirect(pathname))
    const redirectResponse = NextResponse.redirect(url)
    return applyCspHeaders(redirectResponse, nonce)
  }

  if (user && isAuthRoute) {
    const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url))
    return applyCspHeaders(redirectResponse, nonce)
  }

  return applyCspHeaders(supabaseResponse, nonce)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images.
     * This ensures CSP headers are applied to all pages and API routes.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
