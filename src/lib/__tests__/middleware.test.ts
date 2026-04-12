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

import { safeRedirect, buildCspHeader, middleware } from '@/middleware'
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
// middleware() — integration tests
// ═══════════════════════════════════════════════════════════════════════════
describe('middleware', () => {
  function makeRequest(path: string): NextRequest {
    return new NextRequest(new URL(path, 'http://localhost:3000'))
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
})
