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
    // Violation reporting — the /api/security/csp-report endpoint persists
    // each violation for review. Without this directive, the CSP report
    // endpoint (which already exists) would never receive anything.
    // `report-uri` is the legacy mechanism (broad browser support);
    // `report-to` is the modern one, paired with the Report-To response
    // header set in applyCspHeaders below.
    'report-uri /api/security/csp-report',
    'report-to csp-endpoint',
  ].join('; ')
}

/** Set the CSP, Report-To, and x-nonce headers on a response. */
function applyCspHeaders(response: NextResponse, nonce: string): NextResponse {
  response.headers.set('Content-Security-Policy', buildCspHeader(nonce))
  // Report-To enables the modern (Reporting API) CSP reporting path, matching
  // the `report-to csp-endpoint` directive in the CSP header. `max_age` of 1
  // day keeps the endpoint registration fresh without thrashing the browser.
  response.headers.set(
    'Report-To',
    JSON.stringify({
      group: 'csp-endpoint',
      max_age: 86400,
      endpoints: [{ url: '/api/security/csp-report' }],
    }),
  )
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

// Routes that REQUIRE a fully MFA-verified session (AAL2) when MFA is
// enforced for the user. Sub-routes like `/dashboard/org/security/mfa` are
// excluded so a user mid-enrolment can complete setup without being kicked
// in a redirect loop.
const MFA_REQUIRED_ROUTES = ['/dashboard/org', '/dashboard/billing', '/dashboard/audit-logs']
const MFA_SETUP_EXCEPTIONS = ['/dashboard/org/security']

function requiresMfa(pathname: string): boolean {
  if (MFA_SETUP_EXCEPTIONS.some((p) => pathname.startsWith(p))) return false
  return MFA_REQUIRED_ROUTES.some((p) => pathname.startsWith(p))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Generate a nonce per request for CSP (Edge-compatible Web Crypto API)
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  // Pass nonce to Server Components via request header
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  const supabaseResponse = NextResponse.next({
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

  // MFA enforcement on sensitive sub-routes. We use Supabase's Authenticator
  // Assurance Level (AAL) — AAL2 means the user passed a second factor in
  // the current session. If the user has enrolled MFA factors but only
  // satisfied AAL1, redirect to the MFA challenge page. Users who haven't
  // enrolled (yet) are nudged to the setup page once we're past the soft
  // launch; today the redirect is gated on AIO_REQUIRE_MFA env var so it
  // can be turned on per environment.
  if (user && isProtectedRoute && requiresMfa(pathname) && process.env.AIO_REQUIRE_MFA === 'true') {
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal && aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
        // Enrolled but not stepped up in this session → challenge required.
        const url = new URL('/auth/mfa', request.url)
        url.searchParams.set('redirect', safeRedirect(pathname))
        return applyCspHeaders(NextResponse.redirect(url), nonce)
      }
      if (aal && aal.currentLevel === 'aal1' && aal.nextLevel === 'aal1') {
        // No factors enrolled at all → send to setup. The setup page itself
        // is in MFA_SETUP_EXCEPTIONS so this isn't a redirect loop.
        const url = new URL('/dashboard/org/security/mfa', request.url)
        url.searchParams.set('reason', 'required')
        return applyCspHeaders(NextResponse.redirect(url), nonce)
      }
    } catch {
      // MFA API failure shouldn't lock people out — fail open here. If MFA
      // is mandatory by policy, the dashboard page itself does a second
      // server-side check that will block.
    }
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
