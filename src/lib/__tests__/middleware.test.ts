import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// safeRedirect and buildCspHeader are exported from src/middleware.ts
// We test them directly; middleware() is tested through integration-style mocks.
// ---------------------------------------------------------------------------

// Mock dependencies BEFORE importing the module under test
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  })),
}))

vi.mock('@/lib/ratelimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    success: true,
    remaining: 99,
    resetAt: Date.now() + 60_000,
  }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

import { safeRedirect, buildCspHeader, resolveAllowedOrigin, middleware } from '@/middleware'
import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { checkRateLimit } from '@/lib/ratelimit'

// ---------------------------------------------------------------------------
// Env setup
// ---------------------------------------------------------------------------
const originalEnv = { ...process.env }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
})

afterEach(() => {
  process.env = { ...originalEnv }
})

// ═══════════════════════════════════════════════════════════════════════════
// safeRedirect — open redirect prevention
// ═══════════════════════════════════════════════════════════════════════════
describe('safeRedirect', () => {
  it('allows simple absolute path', () => {
    expect(safeRedirect('/dashboard')).toBe('/dashboard')
  })

  it('allows nested path', () => {
    expect(safeRedirect('/dashboard/brands/123')).toBe('/dashboard/brands/123')
  })

  it('allows path with query string', () => {
    expect(safeRedirect('/dashboard?tab=settings')).toBe('/dashboard?tab=settings')
  })

  it('rejects empty string', () => {
    expect(safeRedirect('')).toBe('/dashboard')
  })

  it('rejects protocol-relative URL (//evil.com)', () => {
    expect(safeRedirect('//evil.com')).toBe('/dashboard')
  })

  it('rejects URL with protocol (https://evil.com)', () => {
    expect(safeRedirect('https://evil.com')).toBe('/dashboard')
  })

  it('rejects URL with embedded protocol (javascript://)', () => {
    expect(safeRedirect('javascript://alert(1)')).toBe('/dashboard')
  })

  it('rejects path with backslash', () => {
    expect(safeRedirect('/foo\\bar')).toBe('/dashboard')
  })

  it('rejects path with null byte', () => {
    expect(safeRedirect('/foo\0bar')).toBe('/dashboard')
  })

  it('rejects path with encoded null byte (%00)', () => {
    expect(safeRedirect('/foo%00bar')).toBe('/dashboard')
  })

  it('rejects relative path without leading slash', () => {
    expect(safeRedirect('dashboard')).toBe('/dashboard')
  })

  it('rejects URL with ://', () => {
    expect(safeRedirect('/foo://bar')).toBe('/dashboard')
  })

  it('uses custom fallback when provided', () => {
    expect(safeRedirect('', '/home')).toBe('/home')
  })

  it('uses custom fallback for invalid URL', () => {
    expect(safeRedirect('//evil.com', '/login')).toBe('/login')
  })

  it('allows root path', () => {
    expect(safeRedirect('/')).toBe('/')
  })

  it('preserves search params after normalization', () => {
    expect(safeRedirect('/page?a=1&b=2')).toBe('/page?a=1&b=2')
  })

  it('rejects data: protocol URLs', () => {
    expect(safeRedirect('data:text/html,<script>alert(1)</script>')).toBe('/dashboard')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// buildCspHeader — Content-Security-Policy generation
// ═══════════════════════════════════════════════════════════════════════════
describe('buildCspHeader', () => {
  it('includes the nonce in script-src', () => {
    const csp = buildCspHeader('test-nonce-123')
    expect(csp).toContain("'nonce-test-nonce-123'")
  })

  it('includes default-src self', () => {
    const csp = buildCspHeader('n')
    expect(csp).toContain("default-src 'self'")
  })

  it('includes unsafe-inline as fallback for older browsers', () => {
    const csp = buildCspHeader('n')
    expect(csp).toContain("'unsafe-inline'")
  })

  it('includes frame-ancestors none for clickjacking protection', () => {
    const csp = buildCspHeader('n')
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('allows supabase connect-src', () => {
    const csp = buildCspHeader('n')
    expect(csp).toContain('https://*.supabase.co')
  })

  it('allows data: for img-src', () => {
    const csp = buildCspHeader('n')
    expect(csp).toContain('img-src')
    expect(csp).toContain('data:')
  })

  it('uses semicolons to separate directives', () => {
    const csp = buildCspHeader('n')
    const directives = csp.split('; ')
    expect(directives.length).toBeGreaterThanOrEqual(6)
  })

  it('includes connect-src for AI providers', () => {
    const csp = buildCspHeader('n')
    expect(csp).toContain('https://api.openai.com')
    expect(csp).toContain('https://generativelanguage.googleapis.com')
    expect(csp).toContain('https://api.perplexity.ai')
    expect(csp).toContain('https://api.anthropic.com')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// resolveAllowedOrigin — env-derived CORS allowlist
// ═══════════════════════════════════════════════════════════════════════════
describe('resolveAllowedOrigin', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'
    delete process.env.CORS_ALLOWED_ORIGINS
  })

  it('returns null when no Origin header is present (same-origin / server-side)', () => {
    expect(resolveAllowedOrigin(null)).toBeNull()
  })

  it('allows the NEXT_PUBLIC_APP_URL origin', () => {
    expect(resolveAllowedOrigin('https://app.example.com')).toBe('https://app.example.com')
  })

  it('rejects an unknown origin', () => {
    expect(resolveAllowedOrigin('https://evil.com')).toBeNull()
  })

  it('rejects a path/query mismatch on the same host (compares origin only)', () => {
    // URL.origin strips path, so a bare origin still matches; a different port
    // must NOT match.
    expect(resolveAllowedOrigin('https://app.example.com:8443')).toBeNull()
  })

  it('allows extra origins from CORS_ALLOWED_ORIGINS (comma-separated, trimmed)', () => {
    process.env.CORS_ALLOWED_ORIGINS = ' https://admin.example.com , https://www.example.com '
    expect(resolveAllowedOrigin('https://admin.example.com')).toBe('https://admin.example.com')
    expect(resolveAllowedOrigin('https://www.example.com')).toBe('https://www.example.com')
  })

  it('allows https Vercel preview deployments (*.vercel.app)', () => {
    expect(resolveAllowedOrigin('https://my-branch-abc123.vercel.app')).toBe(
      'https://my-branch-abc123.vercel.app',
    )
  })

  it('rejects http (non-https) vercel.app origins', () => {
    expect(resolveAllowedOrigin('http://my-branch.vercel.app')).toBeNull()
  })

  it('rejects a lookalike host that merely contains vercel.app', () => {
    expect(resolveAllowedOrigin('https://vercel.app.evil.com')).toBeNull()
  })

  it('does not throw on a malformed origin string', () => {
    expect(resolveAllowedOrigin('not a url')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// middleware() — integration tests
// ═══════════════════════════════════════════════════════════════════════════
describe('middleware', () => {
  function makeRequest(path: string): NextRequest {
    return new NextRequest(new URL(path, 'http://localhost:3000'))
  }

  function makeApiRequest(path: string, init: { method?: string; origin?: string }): NextRequest {
    const headers = new Headers()
    if (init.origin) headers.set('origin', init.origin)
    return new NextRequest(new URL(path, 'http://localhost:3000'), {
      method: init.method ?? 'GET',
      headers,
    })
  }

  it('sets CSP header on every response', async () => {
    const res = await middleware(makeRequest('/'))
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy()
  })

  it('sets x-nonce header on every response', async () => {
    const res = await middleware(makeRequest('/'))
    const nonce = res.headers.get('x-nonce')
    expect(nonce).toBeTruthy()
    expect(nonce!.length).toBeGreaterThan(0)
  })

  it('CSP header contains the same nonce as x-nonce header', async () => {
    const res = await middleware(makeRequest('/'))
    const nonce = res.headers.get('x-nonce')
    const csp = res.headers.get('Content-Security-Policy')
    expect(csp).toContain(`'nonce-${nonce}'`)
  })

  // Rate limiting headers on API routes
  it('adds rate limit headers for /api/ routes', async () => {
    const res = await middleware(makeRequest('/api/brands'))
    expect(res.headers.get('X-RateLimit-Limit')).toBe('100')
    expect(res.headers.get('X-RateLimit-Remaining')).toBeTruthy()
    expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy()
  })

  it('does not add rate limit headers for non-API routes', async () => {
    const res = await middleware(makeRequest('/about'))
    expect(res.headers.get('X-RateLimit-Limit')).toBeNull()
  })

  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 30_000,
    })
    const res = await middleware(makeRequest('/api/brands'))
    expect(res.status).toBe(429)
  })

  it('429 response includes Retry-After header', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 30_000,
    })
    const res = await middleware(makeRequest('/api/brands'))
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })

  it('429 response still includes CSP header', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 30_000,
    })
    const res = await middleware(makeRequest('/api/brands'))
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy()
  })

  // Protected route behavior
  it('redirects unauthenticated users from /dashboard to /auth/login', async () => {
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as never)

    const res = await middleware(makeRequest('/dashboard'))
    expect(res.status).toBe(307)
    const location = res.headers.get('location') || ''
    expect(location).toContain('/auth/login')
  })

  it('redirect to login includes safe redirect param', async () => {
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as never)

    const res = await middleware(makeRequest('/dashboard/brands'))
    const location = res.headers.get('location') || ''
    expect(location).toContain('redirect=%2Fdashboard%2Fbrands')
  })

  it('allows unauthenticated users to access non-protected routes', async () => {
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as never)

    const res = await middleware(makeRequest('/about'))
    // Not a redirect
    expect(res.status).not.toBe(307)
  })

  it('redirects authenticated users away from auth routes to /dashboard', async () => {
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'test@test.com' } },
          error: null,
        }),
      },
    } as never)

    const res = await middleware(makeRequest('/auth/login'))
    expect(res.status).toBe(307)
    const location = res.headers.get('location') || ''
    expect(location).toContain('/dashboard')
  })

  it('allows authenticated users to access /dashboard', async () => {
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'test@test.com' } },
          error: null,
        }),
      },
    } as never)

    const res = await middleware(makeRequest('/dashboard'))
    expect(res.status).not.toBe(307)
  })

  // Missing Supabase env vars
  it('falls back gracefully when Supabase env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const res = await middleware(makeRequest('/dashboard'))
    // Should not throw, should return a response with CSP
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy()
  })

  // Nested protected routes
  it('protects nested dashboard routes like /dashboard/settings', async () => {
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as never)

    const res = await middleware(makeRequest('/dashboard/settings'))
    expect(res.status).toBe(307)
    const location = res.headers.get('location') || ''
    expect(location).toContain('/auth/login')
  })

  // CORS — env-derived allowlist on /api/* (replaces the static vercel.json header)
  describe('CORS', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
      delete process.env.CORS_ALLOWED_ORIGINS
    })

    it('answers an OPTIONS preflight with 204 and the allowed origin', async () => {
      const res = await middleware(
        makeApiRequest('/api/brands', { method: 'OPTIONS', origin: 'http://localhost:3000' }),
      )
      expect(res.status).toBe(204)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
      expect(res.headers.get('Content-Security-Policy')).toBeTruthy()
    })

    it('sets ACAO on a normal /api request from an allowed origin', async () => {
      const res = await middleware(
        makeApiRequest('/api/brands', { origin: 'http://localhost:3000' }),
      )
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
      expect(res.headers.get('Vary')).toContain('Origin')
    })

    it('omits ACAO for a disallowed origin', async () => {
      const res = await middleware(makeApiRequest('/api/brands', { origin: 'https://evil.com' }))
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })

    it('omits ACAO when there is no Origin header (same-origin)', async () => {
      const res = await middleware(makeApiRequest('/api/brands', {}))
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })

    it('echoes ACAO on a 429 rate-limit response for an allowed origin', async () => {
      vi.mocked(checkRateLimit).mockResolvedValueOnce({
        success: false,
        remaining: 0,
        resetAt: Date.now() + 30_000,
      })
      const res = await middleware(
        makeApiRequest('/api/brands', { origin: 'http://localhost:3000' }),
      )
      expect(res.status).toBe(429)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
    })
  })
})
