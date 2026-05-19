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
})
