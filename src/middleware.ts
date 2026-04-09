import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'

function safeRedirect(url: string, fallback = '/dashboard'): string {
  if (url && url.startsWith('/') && !url.includes('://') && !url.startsWith('//')) {
    return url
  }
  return fallback
}

const protectedRoutes = ['/dashboard']
const authRoutes = ['/auth/login', '/auth/register']
const publicApiRoutes: string[] = []

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  let supabaseResponse = NextResponse.next({ request })

  if (pathname.startsWith('/api/')) {
    const identifier = getClientIp(request.headers)
    const { success, remaining, resetAt } = await checkRateLimit(identifier, 100, 60_000)

    if (!success) {
      return NextResponse.json(
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
    }

    supabaseResponse.headers.set('X-RateLimit-Limit', '100')
    supabaseResponse.headers.set('X-RateLimit-Remaining', String(remaining))
    supabaseResponse.headers.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request })
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
    return supabaseResponse
  }

  if (!user && isProtectedRoute) {
    const url = new URL('/auth/login', request.url)
    url.searchParams.set('redirect', safeRedirect(pathname))
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/auth/:path*', '/api/:path*'],
}
