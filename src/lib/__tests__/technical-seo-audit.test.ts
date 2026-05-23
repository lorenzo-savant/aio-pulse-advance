import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { runTechnicalAudit } from '../services/technical-seo-audit'

// runTechnicalAudit calls safeFetch, which does DNS resolution + private-IP
// rejection before any HTTP request. The synthetic URLs in these tests
// (good.example / bad.example) don't resolve via real DNS, so safeFetch would
// throw and the test's global.fetch mock would never be reached — the result
// is that mocked robots.txt / llms.txt content is treated as missing, and
// e.g. the GPTBot check flips from 'fail' to 'info'.
// Mock safeFetch to pass through directly to the test's global.fetch mock.
vi.mock('@/lib/utils/safe-fetch', () => ({
  safeFetch: vi.fn((url: string | URL, opts?: RequestInit) =>
    fetch(typeof url === 'string' ? url : url.toString(), opts),
  ),
  SsrfError: class SsrfError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message)
    }
  },
}))

const HTML_RICH = `<!doctype html>
<html>
<head>
  <title>Acme — Workflow Automation</title>
  <meta name="description" content="B2B automation platform for teams.">
  <link rel="canonical" href="https://acme.com/">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme"}</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Acme"}</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList"}</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage"}</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script>
</head>
<body><h1>Acme</h1></body>
</html>`

const HTML_POOR = `<!doctype html><html><body><p>no head</p></body></html>`

const ROBOTS_ALLOW_ALL = `User-agent: *
Allow: /`

const ROBOTS_BLOCK_AI = `User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: PerplexityBot
Disallow: /`

const LLMS_TXT_GOOD = `# Acme\n\n## About\nAutomation for teams.\n\n## Products\n- Flow: workflow builder\n${'x'.repeat(200)}`

function mockResponse(body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, { status: 200, headers })
}

describe('runTechnicalAudit', () => {
  let originalFetch: typeof fetch

  beforeEach(() => {
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns a high overall score for a well-optimized site', async () => {
    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.endsWith('/robots.txt')) return mockResponse(ROBOTS_ALLOW_ALL)
      if (url.endsWith('/llms.txt')) return mockResponse(LLMS_TXT_GOOD)
      return mockResponse(HTML_RICH, {
        'strict-transport-security': 'max-age=31536000',
        'content-security-policy': "default-src 'self'",
        'x-content-type-options': 'nosniff',
      })
    }) as typeof fetch

    const result = await runTechnicalAudit('https://acme.com')

    expect(result.url).toBe('https://acme.com')
    expect(result.overallScore).toBeGreaterThan(60)
    expect(result.categories.llmsTxt.score).toBeGreaterThan(50)
    expect(result.categories.schemaMarkup.score).toBeGreaterThan(50)
    expect(result.categories.metaTags.score).toBe(100)
    expect(result.categories.securityHeaders.score).toBe(100)
  })

  it('flags missing llms.txt, missing schema, and blocked AI bots', async () => {
    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.endsWith('/robots.txt')) return mockResponse(ROBOTS_BLOCK_AI)
      if (url.endsWith('/llms.txt')) return new Response('', { status: 404 })
      return mockResponse(HTML_POOR)
    }) as typeof fetch

    const result = await runTechnicalAudit('http://bad.example')

    expect(result.categories.llmsTxt.score).toBe(0)
    expect(result.categories.schemaMarkup.score).toBe(0)
    expect(result.categories.securityHeaders.score).toBeLessThan(50)
    const gptCheck = result.categories.aiCrawlerAccess.checks.find(
      (c) => c.id === 'ai-crawler-gptbot',
    )
    expect(gptCheck?.status).toBe('fail')
  })

  it('reports an ISO timestamp and the original url', async () => {
    global.fetch = vi.fn(async () => mockResponse(HTML_POOR)) as typeof fetch
    const result = await runTechnicalAudit('https://example.com/page')
    expect(result.url).toBe('https://example.com/page')
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('flags missing HTTPS for http:// urls', async () => {
    global.fetch = vi.fn(async () => mockResponse(HTML_POOR)) as typeof fetch
    const result = await runTechnicalAudit('http://insecure.example')
    const httpsCheck = result.categories.securityHeaders.checks.find(
      (c) => c.id === 'security-https',
    )
    expect(httpsCheck?.status).toBe('fail')
  })

  // ─── contentStructure category (new deterministic on-page checks) ─────────

  it('contentStructure: HTML_RICH has no warnings (good baseline)', async () => {
    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.endsWith('/robots.txt')) return mockResponse(ROBOTS_ALLOW_ALL)
      if (url.endsWith('/llms.txt')) return mockResponse(LLMS_TXT_GOOD)
      return mockResponse(HTML_RICH)
    }) as typeof fetch

    const result = await runTechnicalAudit('https://acme.com')
    const cs = result.categories.contentStructure
    expect(cs).toBeDefined()
    expect(cs.score).toBe(100)
    expect(cs.checks.some((c) => c.status === 'warning' || c.status === 'fail')).toBe(false)
  })

  it('contentStructure: flags multi-H1, missing alt, noindex, partial OG, and mixed content', async () => {
    const HTML_BAD_STRUCTURE = `<!doctype html><html><head>
      <title>X</title>
      <meta name="robots" content="noindex, follow">
      <meta property="og:title" content="X">
      <link rel="canonical" href="https://x.com/page">
      <meta property="og:url" content="https://x.com/different">
    </head><body>
      <h1>One</h1><h1>Two</h1>
      <img src="/a.png">
      <img src="/b.png" alt="b">
      <script src="http://cdn.example.com/lib.js"></script>
    </body></html>`

    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.endsWith('/robots.txt')) return mockResponse(ROBOTS_ALLOW_ALL)
      if (url.endsWith('/llms.txt')) return new Response('', { status: 404 })
      return mockResponse(HTML_BAD_STRUCTURE)
    }) as typeof fetch

    const result = await runTechnicalAudit('https://x.com/page')
    const cs = result.categories.contentStructure

    const byId = Object.fromEntries(cs.checks.map((c) => [c.id, c]))
    expect(byId['content-multi-h1']?.status).toBe('warning')
    expect(byId['content-img-alt']?.status).toBe('warning')
    expect(byId['content-img-alt']?.message).toMatch(/1\/2/)
    expect(byId['content-meta-robots']?.status).toBe('warning')
    expect(byId['content-meta-robots']?.message).toMatch(/noindex/)
    expect(byId['content-og']?.status).toBe('warning')
    expect(byId['content-og']?.message).toMatch(/og:description/)
    expect(byId['content-canonical-consistency']?.status).toBe('warning')
    expect(byId['content-mixed']?.status).toBe('warning')
    expect(cs.score).toBeLessThan(50)
  })

  it('contentStructure: passes valid hreflang and skips mixed-content on http://', async () => {
    const HTML_HREFLANG = `<!doctype html><html><head>
      <title>Y</title>
      <link rel="alternate" hreflang="en" href="https://y.com/">
      <link rel="alternate" hreflang="it-IT" href="https://y.com/it/">
      <link rel="alternate" hreflang="x-default" href="https://y.com/">
    </head><body><h1>Y</h1></body></html>`

    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.endsWith('/robots.txt')) return mockResponse(ROBOTS_ALLOW_ALL)
      if (url.endsWith('/llms.txt')) return new Response('', { status: 404 })
      return mockResponse(HTML_HREFLANG)
    }) as typeof fetch

    const result = await runTechnicalAudit('http://y.com')
    const cs = result.categories.contentStructure
    const byId = Object.fromEntries(cs.checks.map((c) => [c.id, c]))
    expect(byId['content-hreflang']?.status).toBe('pass')
    expect(byId['content-hreflang']?.message).toMatch(/with x-default/)
    expect(byId['content-mixed']?.status).toBe('info') // http:// page -> skipped
  })
})
