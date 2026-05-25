import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { runTechnicalAudit, __clearPsiCacheForTests } from '../services/technical-seo-audit'

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
  <meta name="author" content="Jane Doe">
  <link rel="canonical" href="https://acme.com/">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme"}</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Acme"}</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList"}</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage"}</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","author":{"@type":"Person","name":"Jane Doe"},"reviewedBy":{"@type":"Person","name":"John Smith"}}</script>
</head>
<body>
  <h1>Acme</h1>
  <p>Our research surveyed 500 teams and produced the dataset below.</p>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>A</td><td>1</td></tr>
    <tr><td>B</td><td>2</td></tr>
    <tr><td>C</td><td>3</td></tr>
  </table>
</body>
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

  // ─── PageSpeed Insights (Core Web Vitals) ────────────────────────────────

  it('integrates PageSpeed Insights when available (uses Lighthouse score + CWV checks)', async () => {
    process.env['PAGESPEED_API_KEY'] = 'test-key'
    __clearPsiCacheForTests()
    try {
      const PSI_RESPONSE = {
        lighthouseResult: {
          categories: { performance: { score: 0.92 } },
          audits: {
            'largest-contentful-paint': { numericValue: 1800 },
            'cumulative-layout-shift': { numericValue: 0.05 },
            'interaction-to-next-paint': { numericValue: 150 },
          },
        },
      }
      global.fetch = vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('pagespeedonline')) return mockResponse(JSON.stringify(PSI_RESPONSE))
        if (url.endsWith('/robots.txt')) return mockResponse(ROBOTS_ALLOW_ALL)
        if (url.endsWith('/llms.txt')) return mockResponse(LLMS_TXT_GOOD)
        return mockResponse(HTML_RICH)
      }) as typeof fetch

      const result = await runTechnicalAudit('https://psi-fast.example')
      const perf = result.categories.performance
      // Lighthouse performance score (0.92 -> 92) becomes the canonical perf score.
      expect(perf.score).toBe(92)
      const byId = Object.fromEntries(perf.checks.map((c) => [c.id, c]))
      expect(byId['perf-lcp']?.status).toBe('pass')
      expect(byId['perf-lcp']?.message).toMatch(/LCP good/)
      expect(byId['perf-cls']?.status).toBe('pass')
      expect(byId['perf-inp']?.status).toBe('pass')
    } finally {
      delete process.env['PAGESPEED_API_KEY']
      __clearPsiCacheForTests()
    }
  })

  it('PSI: flags poor LCP/CLS/INP with the correct severity', async () => {
    process.env['PAGESPEED_API_KEY'] = 'test-key'
    __clearPsiCacheForTests()
    try {
      const POOR_PSI = {
        lighthouseResult: {
          categories: { performance: { score: 0.25 } },
          audits: {
            'largest-contentful-paint': { numericValue: 5200 },
            'cumulative-layout-shift': { numericValue: 0.4 },
            'interaction-to-next-paint': { numericValue: 700 },
          },
        },
      }
      global.fetch = vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('pagespeedonline')) return mockResponse(JSON.stringify(POOR_PSI))
        if (url.endsWith('/robots.txt')) return mockResponse(ROBOTS_ALLOW_ALL)
        if (url.endsWith('/llms.txt')) return new Response('', { status: 404 })
        return mockResponse(HTML_RICH)
      }) as typeof fetch

      const result = await runTechnicalAudit('https://psi-slow.example')
      const byId = Object.fromEntries(result.categories.performance.checks.map((c) => [c.id, c]))
      expect(byId['perf-lcp']?.status).toBe('fail')
      expect(byId['perf-cls']?.status).toBe('fail')
      expect(byId['perf-inp']?.status).toBe('fail')
      expect(result.categories.performance.score).toBe(25)
    } finally {
      delete process.env['PAGESPEED_API_KEY']
      __clearPsiCacheForTests()
    }
  })

  it('PSI: skipped (no quota hit) when PAGESPEED_API_KEY is not set', async () => {
    delete process.env['PAGESPEED_API_KEY']
    __clearPsiCacheForTests()
    // Count fetch calls; PSI URL must NEVER appear.
    let psiCallCount = 0
    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('pagespeedonline')) psiCallCount++
      if (url.endsWith('/robots.txt')) return mockResponse(ROBOTS_ALLOW_ALL)
      if (url.endsWith('/llms.txt')) return mockResponse(LLMS_TXT_GOOD)
      return mockResponse(HTML_RICH)
    }) as typeof fetch

    const result = await runTechnicalAudit('https://no-key.example')
    expect(psiCallCount).toBe(0)
    // Performance still has its TTFB/size checks (no LCP/CLS/INP since PSI skipped).
    const ids = result.categories.performance.checks.map((c) => c.id)
    expect(ids).toContain('perf-ttfb')
    expect(ids).not.toContain('perf-lcp')
  })

  // ─── content-last-updated (freshness) ────────────────────────────────────

  it('content-last-updated: flags pages with no machine-readable date as info', async () => {
    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.endsWith('/robots.txt')) return mockResponse(ROBOTS_ALLOW_ALL)
      if (url.endsWith('/llms.txt')) return new Response('', { status: 404 })
      return mockResponse(HTML_RICH) // HTML_RICH has no date metadata
    }) as typeof fetch

    const result = await runTechnicalAudit('https://acme.com')
    const check = result.categories.contentStructure.checks.find(
      (c) => c.id === 'content-last-updated',
    )
    expect(check?.status).toBe('info')
    expect(check?.message).toMatch(/No machine-readable/)
  })

  it('content-last-updated: passes when JSON-LD dateModified is recent', async () => {
    const recent = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const HTML_FRESH = `<!doctype html><html><head>
      <title>x</title>
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","dateModified":"${recent}"}</script>
    </head><body><h1>x</h1></body></html>`

    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.endsWith('/robots.txt')) return mockResponse(ROBOTS_ALLOW_ALL)
      if (url.endsWith('/llms.txt')) return new Response('', { status: 404 })
      return mockResponse(HTML_FRESH)
    }) as typeof fetch

    const result = await runTechnicalAudit('https://fresh.example')
    const check = result.categories.contentStructure.checks.find(
      (c) => c.id === 'content-last-updated',
    )
    expect(check?.status).toBe('pass')
    expect(check?.message).toMatch(/fresh|Updated/)
  })

  it('content-last-updated: warns when content is older than 365 days', async () => {
    const stale = '2023-01-15T00:00:00.000Z' // unambiguously >365 days old
    const HTML_STALE = `<!doctype html><html><head>
      <meta property="article:modified_time" content="${stale}">
    </head><body><h1>x</h1></body></html>`

    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.endsWith('/robots.txt')) return mockResponse(ROBOTS_ALLOW_ALL)
      if (url.endsWith('/llms.txt')) return new Response('', { status: 404 })
      return mockResponse(HTML_STALE)
    }) as typeof fetch

    const result = await runTechnicalAudit('https://stale.example')
    const check = result.categories.contentStructure.checks.find(
      (c) => c.id === 'content-last-updated',
    )
    expect(check?.status).toBe('warning')
    expect(check?.message).toMatch(/Stale|refresh/)
  })

  // ─── content-answer-first (AEO structure) ───────────────────────────────

  it('content-answer-first: passes when ≥70% of H2/H3 lead with a direct answer', async () => {
    const HTML_ANSWER_FIRST = `<!doctype html><html><body>
      <h1>Guide</h1>
      <h2>What is AEO?</h2>
      <p>AEO is the practice of optimizing content so AI engines cite it in their generated answers, alongside or instead of traditional SERPs.</p>
      <h2>How does it differ from SEO?</h2>
      <p>SEO targets ranked links in search engine results pages, while AEO targets the AI-generated answer itself across ChatGPT, Perplexity, and Gemini.</p>
      <h3>Does it require new tools?</h3>
      <p>No, most AEO work is done with existing CMS and analytics tools — only the metrics and content patterns change.</p>
    </body></html>`

    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.endsWith('/robots.txt')) return mockResponse(ROBOTS_ALLOW_ALL)
      if (url.endsWith('/llms.txt')) return new Response('', { status: 404 })
      return mockResponse(HTML_ANSWER_FIRST)
    }) as typeof fetch

    const result = await runTechnicalAudit('https://answer.example')
    const check = result.categories.contentStructure.checks.find(
      (c) => c.id === 'content-answer-first',
    )
    expect(check?.status).toBe('pass')
    expect(check?.message).toMatch(/answer/i)
  })

  it('content-answer-first: fails when most sections start with weak openers (preambles)', async () => {
    const HTML_PREAMBLES = `<!doctype html><html><body>
      <h1>Guide</h1>
      <h2>What is AEO?</h2>
      <p>In this article we will discuss the practice of AEO and its modern applications across the digital landscape.</p>
      <h2>How does it differ from SEO?</h2>
      <p>In this section we will explore how SEO and AEO compare across several common dimensions and workflows.</p>
      <h3>Does it require new tools?</h3>
      <p>Let's explore the tooling landscape that practitioners are using in 2026 to ship answer-engine work.</p>
    </body></html>`

    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.endsWith('/robots.txt')) return mockResponse(ROBOTS_ALLOW_ALL)
      if (url.endsWith('/llms.txt')) return new Response('', { status: 404 })
      return mockResponse(HTML_PREAMBLES)
    }) as typeof fetch

    const result = await runTechnicalAudit('https://preamble.example')
    const check = result.categories.contentStructure.checks.find(
      (c) => c.id === 'content-answer-first',
    )
    expect(check?.status).toBe('fail')
    expect(check?.message).toMatch(/preamble|filler|Weak openers/i)
  })

  it('content-answer-first: returns info when the page has no H2/H3', async () => {
    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.endsWith('/robots.txt')) return mockResponse(ROBOTS_ALLOW_ALL)
      if (url.endsWith('/llms.txt')) return new Response('', { status: 404 })
      return mockResponse(HTML_RICH) // HTML_RICH has only an H1
    }) as typeof fetch

    const result = await runTechnicalAudit('https://h1only.example')
    const check = result.categories.contentStructure.checks.find(
      (c) => c.id === 'content-answer-first',
    )
    expect(check?.status).toBe('info')
  })

  it('content-answer-first: detects Italian and Swedish weak openers', async () => {
    const HTML_ML = `<!doctype html><html><body>
      <h1>Guida</h1>
      <h2>Cos'è l'AEO?</h2>
      <p>In questo articolo parleremo del concetto di AEO e di come si confronta con il SEO classico.</p>
      <h2>Vad är AEO?</h2>
      <p>I den här artikeln kommer vi att gå igenom vad AEO är och hur det skiljer sig från SEO.</p>
    </body></html>`

    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.endsWith('/robots.txt')) return mockResponse(ROBOTS_ALLOW_ALL)
      if (url.endsWith('/llms.txt')) return new Response('', { status: 404 })
      return mockResponse(HTML_ML)
    }) as typeof fetch

    const result = await runTechnicalAudit('https://ml.example')
    const check = result.categories.contentStructure.checks.find(
      (c) => c.id === 'content-answer-first',
    )
    expect(check?.status).toBe('fail')
  })

  // ─── content-eeat-markup (E-E-A-T signals) ──────────────────────────────

  it('content-eeat-markup: passes with author + reviewed-by + original data', async () => {
    const HTML_EEAT = `<!doctype html><html><head>
      <meta name="author" content="Jane Doe">
      <script type="application/ld+json">{"@type":"Article","author":{"@type":"Person","name":"Jane Doe"},"reviewedBy":{"@type":"Person","name":"John Smith"}}</script>
    </head><body>
      <h1>A study</h1>
      <p>Our survey of 1,000 marketers found that AEO matters.</p>
      <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>A</td><td>1</td></tr>
        <tr><td>B</td><td>2</td></tr>
        <tr><td>C</td><td>3</td></tr>
      </table>
    </body></html>`

    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.endsWith('/robots.txt')) return mockResponse(ROBOTS_ALLOW_ALL)
      if (url.endsWith('/llms.txt')) return new Response('', { status: 404 })
      return mockResponse(HTML_EEAT)
    }) as typeof fetch

    const result = await runTechnicalAudit('https://eeat.example')
    const check = result.categories.contentStructure.checks.find(
      (c) => c.id === 'content-eeat-markup',
    )
    expect(check?.status).toBe('pass')
    expect(check?.message).toMatch(/3\/3 E-E-A-T signals/)
  })

  it('content-eeat-markup: warns when only one signal is present', async () => {
    // Deliberately avoid the trigger phrases for reviewed-by and
    // original-data so only the byline signal counts.
    const HTML_PARTIAL = `<!doctype html><html><body>
      <h1>Post</h1>
      <p class="byline">By Alice</p>
      <p>Some general copy about the topic with nothing else specific.</p>
    </body></html>`

    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.endsWith('/robots.txt')) return mockResponse(ROBOTS_ALLOW_ALL)
      if (url.endsWith('/llms.txt')) return new Response('', { status: 404 })
      return mockResponse(HTML_PARTIAL)
    }) as typeof fetch

    const result = await runTechnicalAudit('https://partial.example')
    const check = result.categories.contentStructure.checks.find(
      (c) => c.id === 'content-eeat-markup',
    )
    expect(check?.status).toBe('warning')
    expect(check?.message).toMatch(/Only 1\/3/)
  })

  it('content-eeat-markup: fails when no E-E-A-T signals are present', async () => {
    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.endsWith('/robots.txt')) return mockResponse(ROBOTS_ALLOW_ALL)
      if (url.endsWith('/llms.txt')) return new Response('', { status: 404 })
      return mockResponse(HTML_POOR)
    }) as typeof fetch

    const result = await runTechnicalAudit('https://noeeat.example')
    const check = result.categories.contentStructure.checks.find(
      (c) => c.id === 'content-eeat-markup',
    )
    expect(check?.status).toBe('fail')
    expect(check?.message).toMatch(/No E-E-A-T markup found/)
  })

  it('content-eeat-markup: detects original-data via "we surveyed" copy alone', async () => {
    const HTML_RESEARCH = `<!doctype html><html><body>
      <h1>Research</h1>
      <p>We surveyed 500 SEO professionals and found three clear patterns.</p>
    </body></html>`

    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.endsWith('/robots.txt')) return mockResponse(ROBOTS_ALLOW_ALL)
      if (url.endsWith('/llms.txt')) return new Response('', { status: 404 })
      return mockResponse(HTML_RESEARCH)
    }) as typeof fetch

    const result = await runTechnicalAudit('https://research.example')
    const check = result.categories.contentStructure.checks.find(
      (c) => c.id === 'content-eeat-markup',
    )
    // 1 signal (original-data) → warning, but the hit string must include it
    expect(check?.status).toBe('warning')
    expect(check?.message).toMatch(/original-data/)
  })

  it('content-eeat-markup: detects reviewed-by via visible "Medically reviewed by" copy', async () => {
    const HTML_REVIEWED = `<!doctype html><html><body>
      <h1>Health post</h1>
      <p class="reviewer">Medically reviewed by Dr. Brown, MD</p>
      <p>General content here.</p>
    </body></html>`

    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.endsWith('/robots.txt')) return mockResponse(ROBOTS_ALLOW_ALL)
      if (url.endsWith('/llms.txt')) return new Response('', { status: 404 })
      return mockResponse(HTML_REVIEWED)
    }) as typeof fetch

    const result = await runTechnicalAudit('https://reviewed.example')
    const check = result.categories.contentStructure.checks.find(
      (c) => c.id === 'content-eeat-markup',
    )
    expect(check?.message).toMatch(/reviewed-by/)
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
