import { safeFetch } from '@/lib/utils/safe-fetch'
import { analyseZeroClickVulnerability } from '@/lib/utils/zero-click-vulnerability'
import { analyseIntentLength } from '@/lib/utils/intent-length'
import { checkComparisonTable } from '@/lib/utils/comparison-table-check'

export interface AuditCheck {
  id: string
  name: string
  status: 'pass' | 'fail' | 'warning' | 'info'
  message: string
  details?: string
}

export interface AuditCategory {
  score: number
  weight: number
  checks: AuditCheck[]
}

export interface AuditResult {
  url: string
  timestamp: string
  overallScore: number
  categories: {
    aiCrawlerAccess: AuditCategory
    llmsTxt: AuditCategory
    schemaMarkup: AuditCategory
    metaTags: AuditCategory
    securityHeaders: AuditCategory
    performance: AuditCategory
    /**
     * Additional deterministic on-page checks (hreflang, multi-H1, image
     * alt-text, meta robots, Open Graph completeness, canonical vs og:url
     * consistency, mixed-content). Status `info` when a check is not
     * applicable (e.g. no images on the page) so non-applicability never
     * penalizes the score.
     */
    contentStructure: AuditCategory
  }
}

async function fetchWithTimeout(
  url: string,
  ms: number,
  userAgent?: string,
): Promise<Response | null> {
  try {
    return await safeFetch(url, {
      timeout: ms,
      headers: {
        'User-Agent':
          userAgent ||
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
  } catch {
    return null
  }
}

async function fetchText(url: string, timeoutMs = 10000): Promise<string | null> {
  const response = await fetchWithTimeout(url, timeoutMs)
  if (!response || !response.ok) return null
  return response.text().catch(() => null)
}

function getBaseUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return url
  }
}

function parseRobotsTxt(robotsTxt: string): { allowed: Set<string>; disallowed: Set<string> } {
  const allowed = new Set<string>()
  const disallowed = new Set<string>()
  const lines = robotsTxt.split('\n')
  let currentUserAgent = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#') || !trimmed) continue

    const lower = trimmed.toLowerCase()
    if (lower.startsWith('user-agent:')) {
      currentUserAgent = trimmed.slice(11).trim().toLowerCase()
    } else if (lower.startsWith('allow:')) {
      if (currentUserAgent) allowed.add(currentUserAgent)
    } else if (lower.startsWith('disallow:')) {
      if (currentUserAgent) disallowed.add(currentUserAgent)
    }
  }

  return { allowed, disallowed }
}

function checkAiCrawlerAccess(robotsTxt: string | null): AuditCategory {
  const weight = 0.25
  const checks: AuditCheck[] = []

  const aiBots = [
    'gptbot',
    'google-extended',
    'claudebot',
    'perplexitybot',
    'anthropic-ai',
    'ccbot',
  ]

  let allowedCount = 0

  if (!robotsTxt) {
    for (const bot of aiBots) {
      checks.push({
        id: `ai-crawler-${bot}`,
        name: `${bot} access`,
        status: 'info',
        message: 'Robots.txt not found - bot implicitly allowed',
      })
      allowedCount++
    }
  } else {
    const { allowed, disallowed } = parseRobotsTxt(robotsTxt)
    for (const bot of aiBots) {
      const isAllowed = allowed.has(bot) || (!allowed.has(bot) && !disallowed.has(bot))
      checks.push({
        id: `ai-crawler-${bot}`,
        name: `${bot} access`,
        status: isAllowed ? 'pass' : 'fail',
        message: isAllowed ? 'Allowed' : 'Disallowed',
        details: `User-agent: ${bot}`,
      })
      if (isAllowed) allowedCount++
    }
  }

  const score = Math.round((allowedCount / aiBots.length) * 100)

  return { score, weight, checks }
}

function checkLlmsTxt(llmsTxt: string | null): AuditCategory {
  const weight = 0.15
  const checks: AuditCheck[] = []

  if (!llmsTxt) {
    checks.push({
      id: 'llms-txt-exists',
      name: 'llms.txt exists',
      status: 'fail',
      message: 'llms.txt not found',
      details: 'Create llms.txt at root for AI model discoverability',
    })
    return { score: 0, weight, checks }
  }

  checks.push({
    id: 'llms-txt-exists',
    name: 'llms.txt exists',
    status: 'pass',
    message: 'llms.txt found',
  })

  if (llmsTxt.length > 100) {
    checks.push({
      id: 'llms-txt-content',
      name: 'Content length',
      status: 'pass',
      message: `Content length: ${llmsTxt.length} chars`,
    })
  } else {
    checks.push({
      id: 'llms-txt-content',
      name: 'Content length',
      status: 'warning',
      message: `Content too short: ${llmsTxt.length} chars (min 100)`,
    })
  }

  const hasHeadings = /^#\s+.+$/m.test(llmsTxt)
  checks.push({
    id: 'llms-txt-structure',
    name: 'Has heading structure',
    status: hasHeadings ? 'pass' : 'info',
    message: hasHeadings ? 'Markdown headings found' : 'No markdown headings detected',
  })

  let score = 100
  if (!hasHeadings) score -= 25
  if (llmsTxt.length <= 100) score -= 25

  return { score: Math.max(0, score), weight, checks }
}

function checkSchemaMarkup(html: string): AuditCategory {
  // Weight reduced from 0.25 -> 0.20 to make room for the new
  // `contentStructure` category (0.05). Sums to 1.0 across all categories.
  const weight = 0.2
  const checks: AuditCheck[] = []

  const tier1Types = ['Organization', 'WebSite', 'BreadcrumbList', 'FAQPage', 'Article']
  const tier2Types = [
    'LocalBusiness',
    'Product',
    'AggregateRating',
    'HowTo',
    'SpeakableSpecification',
  ]

  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gis
  const matches = html.match(jsonLdRegex) || []

  const foundTypes = new Set<string>()

  for (const match of matches) {
    try {
      const jsonMatch = match.match(
        /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/is,
      )
      if (jsonMatch && jsonMatch[1]) {
        const parsed = JSON.parse(jsonMatch[1].trim())
        const schemas = Array.isArray(parsed) ? parsed : [parsed]

        for (const schema of schemas) {
          const type = schema['@type']
          if (type) {
            if (tier1Types.includes(type)) foundTypes.add(type)
            if (tier2Types.includes(type)) foundTypes.add(type)
          }
        }
      }
    } catch {
      // Invalid JSON-LD
    }
  }

  for (const type of tier1Types) {
    const found = foundTypes.has(type)
    checks.push({
      id: `schema-${type.toLowerCase()}`,
      name: `${type} schema`,
      status: found ? 'pass' : 'fail',
      message: found ? `${type} schema found` : `${type} schema missing`,
    })
  }

  for (const type of tier2Types) {
    const found = foundTypes.has(type)
    checks.push({
      id: `schema-${type.toLowerCase()}`,
      name: `${type} schema`,
      status: found ? 'pass' : 'info',
      message: found ? `${type} schema found` : `${type} schema not present (optional)`,
    })
  }

  const tier1Found = tier1Types.filter((t) => foundTypes.has(t)).length
  const tier2Found = tier2Types.filter((t) => foundTypes.has(t)).length
  const score = Math.min(100, tier1Found * 20 + tier2Found * 5)

  return { score, weight, checks }
}

function checkMetaTags(html: string): AuditCategory {
  const weight = 0.2
  const checks: AuditCheck[] = []

  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is)
  const titleText = titleMatch?.[1]?.trim() ?? ''
  const hasTitle = titleText.length > 0
  const titleOk = titleText.length <= 60

  checks.push({
    id: 'meta-title-present',
    name: 'Title tag present',
    status: hasTitle ? 'pass' : 'fail',
    message: hasTitle ? 'Title tag found' : 'Title tag missing',
  })

  checks.push({
    id: 'meta-title-length',
    name: 'Title length',
    status: titleOk ? 'pass' : 'fail',
    message: titleOk
      ? `Title length OK (${titleText.length} chars)`
      : `Title too long: ${titleText.length} chars (max 60)`,
    details: titleText || undefined,
  })

  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/is)
  const descText = descMatch?.[1]?.trim() ?? ''
  const hasDesc = descText.length > 0
  const descOk = descText.length <= 155

  checks.push({
    id: 'meta-desc-present',
    name: 'Meta description present',
    status: hasDesc ? 'pass' : 'fail',
    message: hasDesc ? 'Meta description found' : 'Meta description missing',
  })

  checks.push({
    id: 'meta-desc-length',
    name: 'Meta description length',
    status: descOk ? 'pass' : 'warning',
    message: descOk
      ? `Description length OK (${descText.length} chars)`
      : `Description too long: ${descText.length} chars (max 155)`,
  })

  const h1Matches = html.match(/<h1[^>]*>(.*?)<\/h1>/gis)
  const hasH1 = h1Matches && h1Matches.length > 0

  checks.push({
    id: 'meta-h1-present',
    name: 'H1 tag present',
    status: hasH1 ? 'pass' : 'fail',
    message: hasH1 ? `H1 tag found (${h1Matches?.length || 0})` : 'H1 tag missing',
  })

  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["'](.*?)["']/is)
  const hasCanonical = !!canonicalMatch

  checks.push({
    id: 'meta-canonical',
    name: 'Canonical URL',
    status: hasCanonical ? 'pass' : 'warning',
    message: hasCanonical ? 'Canonical URL found' : 'Canonical URL missing',
    details: canonicalMatch ? canonicalMatch[1] : undefined,
  })

  let passed = 0
  if (hasTitle) passed++
  if (titleOk) passed++
  if (hasDesc) passed++
  if (hasCanonical) passed++

  const score = Math.round((passed / 4) * 100)

  return { score, weight, checks }
}

function checkSecurityHeaders(response: Response | null, url: string): AuditCategory {
  const weight = 0.1
  const checks: AuditCheck[] = []

  const isHttps = url.startsWith('https://')

  checks.push({
    id: 'security-https',
    name: 'HTTPS',
    status: isHttps ? 'pass' : 'fail',
    message: isHttps ? 'HTTPS enabled' : 'Not using HTTPS',
  })

  const headers = response
    ? {
        'strict-transport-security': response.headers.get('strict-transport-security'),
        'content-security-policy': response.headers.get('content-security-policy'),
        'x-content-type-options': response.headers.get('x-content-type-options'),
      }
    : null

  const hstsCheck = {
    id: 'security-hsts',
    name: 'Strict-Transport-Security',
    status: headers && headers['strict-transport-security'] ? ('pass' as const) : ('fail' as const),
    message:
      headers && headers['strict-transport-security']
        ? 'HSTS header present'
        : 'HSTS header missing',
  }
  checks.push(hstsCheck)

  const cspCheck = {
    id: 'security-csp',
    name: 'Content-Security-Policy',
    status: headers && headers['content-security-policy'] ? ('pass' as const) : ('fail' as const),
    message:
      headers && headers['content-security-policy'] ? 'CSP header present' : 'CSP header missing',
  }
  checks.push(cspCheck)

  const xctoCheck = {
    id: 'security-xcto',
    name: 'X-Content-Type-Options',
    status: headers && headers['x-content-type-options'] ? ('pass' as const) : ('fail' as const),
    message:
      headers && headers['x-content-type-options']
        ? 'X-Content-Type-Options present'
        : 'X-Content-Type-Options missing',
  }
  checks.push(xctoCheck)

  let headerCount = 0
  if (isHttps) headerCount++
  if (headers) {
    if (headers['strict-transport-security']) headerCount++
    if (headers['content-security-policy']) headerCount++
    if (headers['x-content-type-options']) headerCount++
  }

  const score = Math.round((headerCount / 4) * 100)

  return { score, weight, checks }
}

// ─── PageSpeed Insights (real Core Web Vitals) ───────────────────────────────
//
// Free Google API. Quota model:
//   • WITHOUT an API key: shared per-IP pool. From a server (Vercel etc.)
//     this is almost certainly exhausted by other tenants → calls will fail
//     or rate-limit. Each failed attempt still burns the 25s safeFetch
//     timeout, making every audit feel hung. → We SKIP PSI entirely when
//     no key is set and degrade to the TTFB-only score.
//   • WITH PAGESPEED_API_KEY: your own 25,000/day quota. Get one at
//     https://console.cloud.google.com/apis/credentials (enable "PageSpeed
//     Insights API" first). The per-URL in-memory cache below means
//     re-auditing the same URL within 1h costs zero quota.
//
// Rate-limit defenses, in order:
//   1. Skip when no key (avoids dead calls on shared IP).
//   2. Per-URL in-memory cache, 1h TTL, capped at 200 URLs (LRU drop).
//   3. The audit route already has its own 1h CACHE_TTL_MS for the full
//      AuditResult, so most repeated audits never even reach this code.

interface PsiData {
  /** Lighthouse performance score 0–100. */
  performanceScore: number
  /** Largest Contentful Paint (ms). */
  lcpMs?: number
  /** Cumulative Layout Shift (unitless). */
  clsValue?: number
  /** Interaction to Next Paint (ms). */
  inpMs?: number
}

const PSI_CACHE = new Map<string, { data: PsiData | null; expiresAt: number }>()
const PSI_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const PSI_CACHE_MAX = 200

function psiCacheGet(url: string): PsiData | null | undefined {
  const hit = PSI_CACHE.get(url)
  if (!hit) return undefined
  if (hit.expiresAt <= Date.now()) {
    PSI_CACHE.delete(url)
    return undefined
  }
  return hit.data
}

function psiCacheSet(url: string, data: PsiData | null): void {
  if (PSI_CACHE.size >= PSI_CACHE_MAX) {
    const firstKey = PSI_CACHE.keys().next().value
    if (firstKey !== undefined) PSI_CACHE.delete(firstKey)
  }
  PSI_CACHE.set(url, { data, expiresAt: Date.now() + PSI_CACHE_TTL_MS })
}

async function fetchPageSpeedInsights(url: string): Promise<PsiData | null> {
  const apiKey = process.env['PAGESPEED_API_KEY']
  if (!apiKey) return null // no key → skip (see comment above)

  const cached = psiCacheGet(url)
  if (cached !== undefined) return cached

  const params = new URLSearchParams({
    url,
    strategy: 'mobile',
    category: 'performance',
    key: apiKey,
  })
  try {
    const res = await safeFetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`,
      { timeout: 25000 },
    )
    if (!res.ok) {
      psiCacheSet(url, null) // cache the failure too, don't retry-storm
      return null
    }
    const data = (await res.json().catch(() => null)) as {
      lighthouseResult?: {
        categories?: { performance?: { score?: number | null } }
        audits?: Record<string, { numericValue?: number } | undefined>
      }
    } | null
    const perf = data?.lighthouseResult?.categories?.performance
    if (!perf) {
      psiCacheSet(url, null)
      return null
    }
    const a = data?.lighthouseResult?.audits ?? {}
    const result: PsiData = {
      performanceScore: Math.round((perf.score ?? 0) * 100),
      lcpMs: a['largest-contentful-paint']?.numericValue,
      clsValue: a['cumulative-layout-shift']?.numericValue,
      inpMs: a['interaction-to-next-paint']?.numericValue,
    }
    psiCacheSet(url, result)
    return result
  } catch {
    return null
  }
}

/** Test-only: clear the PSI in-memory cache. Not exported for production use. */
export function __clearPsiCacheForTests(): void {
  PSI_CACHE.clear()
}

function checkPerformance(
  response: Response | null,
  startTime: number,
  psi: PsiData | null,
): AuditCategory {
  const weight = 0.05
  const checks: AuditCheck[] = []

  // Server-side TTFB (always available, cheap measurement).
  const ttfb = Date.now() - startTime
  checks.push({
    id: 'perf-ttfb',
    name: 'Time to First Byte',
    status: ttfb < 800 ? 'pass' : ttfb < 1500 ? 'warning' : 'fail',
    message:
      ttfb < 800
        ? `TTFB excellent: ${ttfb}ms`
        : ttfb < 1500
          ? `TTFB acceptable: ${ttfb}ms`
          : `TTFB slow: ${ttfb}ms`,
    details: `${ttfb}ms`,
  })

  const contentLength = response ? response.headers.get('content-length') : null
  const sizeOk = contentLength ? parseInt(contentLength) < 5 * 1024 * 1024 : true
  checks.push({
    id: 'perf-size',
    name: 'Response size',
    status: sizeOk ? 'pass' : 'warning',
    message: sizeOk ? 'Response size OK (< 5MB)' : 'Response size large (> 5MB)',
  })

  // Core Web Vitals from PageSpeed Insights (Google's official thresholds).
  if (psi) {
    if (psi.lcpMs !== undefined) {
      const lcp = Math.round(psi.lcpMs)
      checks.push({
        id: 'perf-lcp',
        name: 'Largest Contentful Paint',
        status: lcp < 2500 ? 'pass' : lcp < 4000 ? 'warning' : 'fail',
        message:
          lcp < 2500
            ? `LCP good: ${lcp}ms`
            : lcp < 4000
              ? `LCP needs improvement: ${lcp}ms (target <2500ms)`
              : `LCP poor: ${lcp}ms (target <2500ms)`,
      })
    }
    if (psi.clsValue !== undefined) {
      const cls = Math.round(psi.clsValue * 1000) / 1000
      checks.push({
        id: 'perf-cls',
        name: 'Cumulative Layout Shift',
        status: cls < 0.1 ? 'pass' : cls < 0.25 ? 'warning' : 'fail',
        message:
          cls < 0.1
            ? `CLS good: ${cls}`
            : cls < 0.25
              ? `CLS needs improvement: ${cls} (target <0.1)`
              : `CLS poor: ${cls} (target <0.1)`,
      })
    }
    if (psi.inpMs !== undefined) {
      const inp = Math.round(psi.inpMs)
      checks.push({
        id: 'perf-inp',
        name: 'Interaction to Next Paint',
        status: inp < 200 ? 'pass' : inp < 500 ? 'warning' : 'fail',
        message:
          inp < 200
            ? `INP good: ${inp}ms`
            : inp < 500
              ? `INP needs improvement: ${inp}ms (target <200ms)`
              : `INP poor: ${inp}ms (target <200ms)`,
      })
    }
    // Use Lighthouse's performance score as canonical when PSI is available —
    // it reflects real-world CWV, not just our server-side TTFB.
    return { score: psi.performanceScore, weight, checks }
  }

  // Fall-back when PSI is unavailable (no key + quota exhausted, network
  // error, parse failure, etc.): score from our own TTFB measurement.
  let score = 25
  if (ttfb < 500) score = 100
  else if (ttfb < 800) score = 75
  else if (ttfb < 1500) score = 50

  return { score, weight, checks }
}

// ─── Content structure (single-URL deterministic) ────────────────────────────
//
// Additional deterministic on-page checks beyond the original 6 categories.
// Status `info` when a check is non-applicable (e.g. no images on the page,
// single-locale site) so missing-by-design never penalizes the score.
// Score = pass / (pass + warning + fail), info excluded; all-info -> 100.

function countMatches(html: string, regex: RegExp): number {
  return [...html.matchAll(regex)].length
}

function checkContentStructure(html: string, url: string): AuditCategory {
  const weight = 0.05
  const checks: AuditCheck[] = []

  // 1) Hreflang — parse <link rel="alternate" hreflang="..." href="...">.
  const hreflangRegex = /<link[^>]*rel=["']alternate["'][^>]*hreflang=["']([^"']+)["'][^>]*>/gi
  const hreflangs: string[] = []
  for (const m of html.matchAll(hreflangRegex)) if (m[1]) hreflangs.push(m[1])
  const hasXDefault = hreflangs.some((c) => c.toLowerCase() === 'x-default')
  const validShape = /^([a-z]{2,3}(-[A-Z]{2})?|x-default)$/
  const invalidLangs = hreflangs.filter((c) => !validShape.test(c))

  if (hreflangs.length === 0) {
    checks.push({
      id: 'content-hreflang',
      name: 'Hreflang',
      status: 'info',
      message: 'No hreflang declared (only relevant for multi-locale sites)',
    })
  } else if (invalidLangs.length > 0) {
    checks.push({
      id: 'content-hreflang',
      name: 'Hreflang',
      status: 'warning',
      message: `Hreflang present but malformed: ${invalidLangs.join(', ')}`,
    })
  } else {
    checks.push({
      id: 'content-hreflang',
      name: 'Hreflang',
      status: 'pass',
      message: `${hreflangs.length} hreflang entries, ${hasXDefault ? 'with' : 'no'} x-default`,
    })
  }

  // 2) Multi-H1 — exactly one H1 per page is the canonical SEO/A11Y rule.
  const h1Count = countMatches(html, /<h1\b[^>]*>/gi)
  checks.push({
    id: 'content-multi-h1',
    name: 'Multiple H1',
    status: h1Count > 1 ? 'warning' : 'pass',
    message:
      h1Count > 1 ? `Page has ${h1Count} H1 tags — keep exactly one` : `H1 count: ${h1Count}`,
  })

  // 3) Image alt-text coverage.
  const imgTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0])
  const imgWithoutAlt = imgTags.filter((t) => !/\salt\s*=\s*["'][^"']*["']/i.test(t))
  if (imgTags.length === 0) {
    checks.push({
      id: 'content-img-alt',
      name: 'Image alt-text',
      status: 'info',
      message: 'No <img> tags on this page',
    })
  } else if (imgWithoutAlt.length === 0) {
    checks.push({
      id: 'content-img-alt',
      name: 'Image alt-text',
      status: 'pass',
      message: `All ${imgTags.length} images have alt attributes`,
    })
  } else {
    checks.push({
      id: 'content-img-alt',
      name: 'Image alt-text',
      status: 'warning',
      message: `${imgWithoutAlt.length}/${imgTags.length} images missing alt attribute`,
    })
  }

  // 4) Meta robots — noindex/nofollow detection.
  const robotsMatch = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i)
  const robotsContent = robotsMatch?.[1]?.toLowerCase() ?? ''
  const hasNoindex = /\bnoindex\b/.test(robotsContent)
  checks.push({
    id: 'content-meta-robots',
    name: 'Meta robots',
    status: hasNoindex ? 'warning' : 'pass',
    message: hasNoindex
      ? `Page is noindex (${robotsContent}) — invisible to search/AI engines`
      : robotsMatch
        ? `Meta robots: ${robotsContent}`
        : 'No meta robots (default: index, follow)',
  })

  // 5) Open Graph completeness (og:title + og:description + og:image).
  const ogTitle = /<meta[^>]*property=["']og:title["']/i.test(html)
  const ogDesc = /<meta[^>]*property=["']og:description["']/i.test(html)
  const ogImage = /<meta[^>]*property=["']og:image["']/i.test(html)
  const ogCount = [ogTitle, ogDesc, ogImage].filter(Boolean).length
  if (ogCount === 0) {
    checks.push({
      id: 'content-og',
      name: 'Open Graph',
      status: 'info',
      message: 'No Open Graph tags (recommended for social/AI link unfurling)',
    })
  } else if (ogCount === 3) {
    checks.push({
      id: 'content-og',
      name: 'Open Graph',
      status: 'pass',
      message: 'og:title, og:description and og:image all present',
    })
  } else {
    const missing = [
      !ogTitle && 'og:title',
      !ogDesc && 'og:description',
      !ogImage && 'og:image',
    ].filter(Boolean) as string[]
    checks.push({
      id: 'content-og',
      name: 'Open Graph',
      status: 'warning',
      message: `Open Graph incomplete — missing: ${missing.join(', ')}`,
    })
  }

  // 6) Canonical vs og:url consistency (only when both are present).
  const canonical = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]
  const ogUrl = html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i)?.[1]
  if (canonical && ogUrl) {
    const matches = canonical.replace(/\/$/, '') === ogUrl.replace(/\/$/, '')
    checks.push({
      id: 'content-canonical-consistency',
      name: 'Canonical vs og:url',
      status: matches ? 'pass' : 'warning',
      message: matches
        ? 'Canonical and og:url agree'
        : `Canonical (${canonical}) and og:url (${ogUrl}) disagree`,
    })
  } else {
    checks.push({
      id: 'content-canonical-consistency',
      name: 'Canonical vs og:url',
      status: 'info',
      message: 'Only one (or neither) of canonical/og:url present — nothing to cross-check',
    })
  }

  // 7) Mixed content — http:// resources referenced from an HTTPS page.
  if (url.startsWith('https://')) {
    const mixed = countMatches(html, /(?:src|href)\s*=\s*["']http:\/\/[^"']+["']/gi)
    checks.push({
      id: 'content-mixed',
      name: 'Mixed content',
      status: mixed === 0 ? 'pass' : 'warning',
      message:
        mixed === 0
          ? 'No http:// resources referenced from this HTTPS page'
          : `${mixed} http:// resource refs on an HTTPS page — browsers block or downgrade these`,
    })
  } else {
    checks.push({
      id: 'content-mixed',
      name: 'Mixed content',
      status: 'info',
      message: 'Page is not HTTPS — mixed-content check skipped',
    })
  }

  // 8) Last-updated freshness — AI engines prefer recently-updated content
  //    (geo-knowledge tactic content-freshness: "<3 months = 3× more likely
  //    to be cited"). We look in 4 places, pick the MOST RECENT parseable
  //    date, and flag the page as stale when nothing is younger than 1 year.
  //
  //    Sources, in priority of reliability:
  //      a. JSON-LD "dateModified" inside any <script type=application/ld+json>
  //      b. <meta property="article:modified_time" content="…">
  //      c. <meta name="last-modified" content="…">
  //      d. The first <time datetime="…">
  const dateCandidates: number[] = []
  for (const m of html.matchAll(/"dateModified"\s*:\s*"([^"]+)"/gi)) {
    const t = Date.parse(m[1]!)
    if (Number.isFinite(t)) dateCandidates.push(t)
  }
  const articleModified = html.match(
    /<meta[^>]*property=["']article:modified_time["'][^>]*content=["']([^"']+)["']/i,
  )
  if (articleModified) {
    const t = Date.parse(articleModified[1]!)
    if (Number.isFinite(t)) dateCandidates.push(t)
  }
  const metaLastModified = html.match(
    /<meta[^>]*name=["']last-modified["'][^>]*content=["']([^"']+)["']/i,
  )
  if (metaLastModified) {
    const t = Date.parse(metaLastModified[1]!)
    if (Number.isFinite(t)) dateCandidates.push(t)
  }
  const timeTag = html.match(/<time[^>]*datetime=["']([^"']+)["']/i)
  if (timeTag) {
    const t = Date.parse(timeTag[1]!)
    if (Number.isFinite(t)) dateCandidates.push(t)
  }

  // 9) Answer-first structure — for every H2/H3, look at the first
  // paragraph that follows and check whether it starts with a direct
  // answer (not a preamble like "In this article we will discuss…").
  // Semrush AEO guidance: "Use the question in a subheading and
  // immediately provide a clear answer." AI engines preferentially
  // cite sections that lead with the answer.
  const WEAK_OPENERS = [
    'in this article',
    'in this section',
    'in this guide',
    'in this post',
    'in this blog',
    'in this chapter',
    "in today's",
    'in the following',
    'we will discuss',
    'we will explore',
    'we will look at',
    'we will see',
    'we will cover',
    "let's explore",
    "let's look at",
    "let's discuss",
    "let's see",
    'this article',
    'this section',
    'this guide',
    'this post',
    'this chapter',
    'this blog',
    'read on to',
    'read more about',
    'keep reading',
    'discover how',
    'find out',
    'learn how',
    'learn more',
    'first,',
    'firstly,',
    'to begin with',
    'before we',
    // Italian
    'in questo articolo',
    'in questa sezione',
    'in questa guida',
    'in questo post',
    'in questa pagina',
    'vedremo',
    'parleremo',
    'scopriamo',
    'analizzeremo',
    'esploreremo',
    // Swedish
    'i den här artikeln',
    'i denna artikel',
    'i det här avsnittet',
    'i denna sektion',
    'i denna guide',
    'vi kommer',
    'vi ska',
    'läs mer om',
    'fortsätt läsa',
  ]
  const subheadings = [
    ...html.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>([\s\S]*?)(?=<h[1-6]\b|$)/gi),
  ]
  function stripTags(s: string): string {
    return s
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
  }
  function firstSentence(text: string): string {
    // Don't break on common abbreviations (e.g. "U.S." or "vs.") — we
    // accept the imperfection and prefer recall.
    const m = text.match(/^[^.!?]{6,400}[.!?]/)
    return (m?.[0] ?? text.slice(0, 200)).trim()
  }
  let answerFirstHits = 0
  const offenders: string[] = []
  for (const sh of subheadings) {
    const body = stripTags(sh[2] ?? '')
    if (body.length === 0) continue
    const sent = firstSentence(body)
    const words = sent.split(/\s+/).filter((w) => w.length > 0)
    const sentLower = sent.toLowerCase()
    const startsWeak = WEAK_OPENERS.some((opener) => sentLower.startsWith(opener))
    if (!startsWeak && words.length >= 6) {
      answerFirstHits++
    } else if (offenders.length < 3) {
      const headingText = stripTags(sh[1] ?? '').slice(0, 60)
      if (headingText) offenders.push(headingText)
    }
  }
  if (subheadings.length === 0) {
    checks.push({
      id: 'content-answer-first',
      name: 'Answer-first sections',
      status: 'info',
      message: 'No H2/H3 subheadings on this page — answer-first analysis n/a',
    })
  } else {
    const rate = Math.round((answerFirstHits / subheadings.length) * 100)
    const detail =
      offenders.length > 0
        ? ` Weak openers under: ${offenders.map((o) => `"${o}"`).join(', ')}`
        : ''
    if (rate >= 70) {
      checks.push({
        id: 'content-answer-first',
        name: 'Answer-first sections',
        status: 'pass',
        message: `${rate}% of ${subheadings.length} subheadings lead with a direct answer — AI engines cite this pattern.`,
      })
    } else if (rate >= 40) {
      checks.push({
        id: 'content-answer-first',
        name: 'Answer-first sections',
        status: 'warning',
        message: `Only ${rate}% of subheadings lead with a direct answer; many start with filler.${detail}`,
      })
    } else {
      checks.push({
        id: 'content-answer-first',
        name: 'Answer-first sections',
        status: 'fail',
        message: `${rate}% answer-first; sections start with preambles instead of answers — AI engines often skip these.${detail}`,
      })
    }
  }

  // 10) E-E-A-T markup — author byline / reviewed-by / original-data signals.
  // Semrush AEO guidance + AirOps study: "LLMs seem to favor content that
  // reflects real-world use, personal insights, and/or original research."
  // We score 3 micro-signals independently then aggregate to pass/warn/fail.
  let eeatSignals = 0
  const eeatHits: string[] = []
  const eeatMisses: string[] = []

  // Signal 1: Author / byline. Accepts JSON-LD Person/author, meta tag,
  // article:author, OR a visible byline class. Any single match counts.
  const hasAuthorMeta = /<meta[^>]*name=["']author["']/i.test(html)
  const hasArticleAuthor = /<meta[^>]*property=["']article:author["']/i.test(html)
  const hasJsonLdAuthor =
    /"author"\s*:\s*\{[^}]*"@type"\s*:\s*"Person"/i.test(html) ||
    /"author"\s*:\s*\[\s*\{[^}]*"@type"\s*:\s*"Person"/i.test(html) ||
    /"@type"\s*:\s*"Person"[^}]*"name"/i.test(html)
  const hasVisibleByline = /class=["'][^"']*\b(byline|author|by-line|posted-by)\b[^"']*["']/i.test(
    html,
  )
  const hasAuthor = hasAuthorMeta || hasArticleAuthor || hasJsonLdAuthor || hasVisibleByline
  if (hasAuthor) {
    eeatSignals++
    eeatHits.push('author')
  } else {
    eeatMisses.push('author byline')
  }

  // Signal 2: Reviewed-by / fact-checked / dateReviewed. Schema.org accepts
  // `reviewedBy` on Article and `dateReviewed` (less common). Many sites
  // also use a visible "Reviewed by …" or "Fact-checked by …" line.
  const hasReviewedBy =
    /"reviewedBy"\s*:/i.test(html) ||
    /"dateReviewed"\s*:/i.test(html) ||
    /\b(reviewed by|fact[- ]checked by|medically reviewed by|expert[- ]reviewed by)\b/i.test(html)
  if (hasReviewedBy) {
    eeatSignals++
    eeatHits.push('reviewed-by')
  } else {
    eeatMisses.push('reviewed-by')
  }

  // Signal 3: Original-data / first-party research signals. A data table
  // with ≥4 rows, OR a chart canvas, OR explicit "our survey/study/research"
  // copy. This is intentionally fuzzy — we want recall, not precision.
  const tableRowCount = countMatches(html, /<tr\b/gi)
  const hasDataTable = tableRowCount >= 4 // header + 3 data rows minimum
  const hasChart =
    /<canvas\b/i.test(html) || /class=["'][^"']*\b(chart|graph|recharts|chartjs|d3-)/i.test(html)
  const hasResearchCopy =
    /\b(our (survey|study|research|analysis|data|experiment|test))\b/i.test(html) ||
    /\b(we (surveyed|studied|analy[zs]ed|tested|interviewed)\b)/i.test(html) ||
    /\b(original (research|data|study))\b/i.test(html)
  const hasOriginalData = hasDataTable || hasChart || hasResearchCopy
  if (hasOriginalData) {
    eeatSignals++
    eeatHits.push('original-data')
  } else {
    eeatMisses.push('original-data')
  }

  const eeatStatus: 'pass' | 'warning' | 'fail' =
    eeatSignals >= 2 ? 'pass' : eeatSignals === 1 ? 'warning' : 'fail'
  checks.push({
    id: 'content-eeat-markup',
    name: 'E-E-A-T signals',
    status: eeatStatus,
    message:
      eeatSignals >= 2
        ? `${eeatSignals}/3 E-E-A-T signals detected: ${eeatHits.join(', ')} — LLMs favour pages with this credibility scaffolding.`
        : eeatSignals === 1
          ? `Only 1/3 E-E-A-T signals (${eeatHits.join(', ')}). Missing: ${eeatMisses.join(', ')}.`
          : `No E-E-A-T markup found (missing ${eeatMisses.join(', ')}). Add an author bio, reviewer attribution, or original data to improve AI-citation odds.`,
  })

  // 11) Zero-click vulnerability — how easily can an AI Overview / featured
  // snippet swallow this page whole? Inverse signal of the audit above:
  // structure + interactivity + original data raise resilience, short
  // definition pages lower it. We surface the score (0-100) + verdict so
  // the operator can prioritise refactors on the most-vulnerable pages.
  // Semrush "Zero-click search" piece: "Short factual queries are often
  // fully answered directly in the SERP… formats like original research,
  // interactive tools, detailed guides remain more resilient."
  const zeroClick = analyseZeroClickVulnerability(html)
  const zcReason = zeroClick.reasons.slice(0, 2).join(' · ')
  const zcStatus: 'pass' | 'warning' | 'fail' =
    zeroClick.verdict === 'resilient'
      ? 'pass'
      : zeroClick.verdict === 'moderate'
        ? 'warning'
        : 'fail'
  checks.push({
    id: 'content-zero-click-vulnerability',
    name: 'Zero-click resilience',
    status: zcStatus,
    message:
      zeroClick.verdict === 'resilient'
        ? `Resilient (score ${zeroClick.score}/100) — page resists AI-Overview replacement. ${zcReason}`
        : zeroClick.verdict === 'moderate'
          ? `Moderate (score ${zeroClick.score}/100) — partially extractable by AI. ${zcReason}`
          : `Vulnerable (score ${zeroClick.score}/100) — AI can replace this page with a summary. ${zcReason}`,
  })

  // 12) Intent × length fit — does this page's depth match what AI
  // engines expect for the query intent? Semrush AI Mode study:
  //   "commercial and transactional queries triggered the longest and
  //    most detailed responses — often double informational length…
  //    informational? clarity and conciseness. commercial? expand."
  const intentLength = analyseIntentLength(html)
  const ilStatus: 'pass' | 'warning' | 'fail' =
    intentLength.fit === 'right_size'
      ? 'pass'
      : intentLength.fit === 'too_short'
        ? 'fail'
        : 'warning'
  checks.push({
    id: 'content-intent-length',
    name: 'Intent × length fit',
    status: ilStatus,
    message:
      intentLength.fit === 'right_size'
        ? `${intentLength.wordCount} words is within the AI-friendly band for ${intentLength.intent} pages (${intentLength.band.min}–${intentLength.band.max}).`
        : intentLength.recommendation,
  })

  // 13) Image-based comparison/pricing table detector — Semrush SaaS-AI
  // pitfall #5: "tables saved as screenshots are invisible to AI
  // extraction". Only fires when the URL signals a pricing or comparison
  // page; on every other URL the check is `info` so it doesn't penalize.
  const cmp = checkComparisonTable(html, url)
  if (cmp.verdict === 'skipped') {
    checks.push({
      id: 'content-comparison-table',
      name: 'Comparison table extractability',
      status: 'info',
      message: 'Not a pricing/comparison page — check skipped',
    })
  } else if (cmp.verdict === 'ok') {
    checks.push({
      id: 'content-comparison-table',
      name: 'Comparison table extractability',
      status: 'pass',
      message: cmp.reason,
    })
  } else {
    checks.push({
      id: 'content-comparison-table',
      name: 'Comparison table extractability',
      status: 'fail',
      message: cmp.reason,
      details:
        cmp.flaggedImages.length > 0
          ? `Image assets: ${cmp.flaggedImages.slice(0, 3).join(', ')}`
          : undefined,
    })
  }

  // 14) Last-updated check (existing — left intact below).
  if (dateCandidates.length === 0) {
    checks.push({
      id: 'content-last-updated',
      name: 'Last updated',
      status: 'info',
      message:
        'No machine-readable last-updated date found (add dateModified JSON-LD or article:modified_time meta — AI engines prefer recent content)',
    })
  } else {
    const mostRecent = Math.max(...dateCandidates)
    const ageDays = Math.floor((Date.now() - mostRecent) / 86_400_000)
    const ageLabel = new Date(mostRecent).toISOString().slice(0, 10)
    if (ageDays < 0) {
      // Future-dated content is suspect (typo or scheduled-publish leak).
      checks.push({
        id: 'content-last-updated',
        name: 'Last updated',
        status: 'warning',
        message: `Last-updated date is in the future (${ageLabel}) — likely a typo or pre-publish leak`,
      })
    } else if (ageDays <= 90) {
      checks.push({
        id: 'content-last-updated',
        name: 'Last updated',
        status: 'pass',
        message: `Updated ${ageDays} days ago (${ageLabel}) — fresh`,
      })
    } else if (ageDays <= 365) {
      checks.push({
        id: 'content-last-updated',
        name: 'Last updated',
        status: 'pass',
        message: `Updated ${ageDays} days ago (${ageLabel})`,
      })
    } else {
      checks.push({
        id: 'content-last-updated',
        name: 'Last updated',
        status: 'warning',
        message: `Stale: last updated ${ageDays} days ago (${ageLabel}) — refresh to improve AI citation odds`,
      })
    }
  }

  let pass = 0
  let warn = 0
  let fail = 0
  for (const c of checks) {
    if (c.status === 'pass') pass++
    else if (c.status === 'warning') warn++
    else if (c.status === 'fail') fail++
  }
  const denom = pass + warn + fail
  const score = denom === 0 ? 100 : Math.round((pass / denom) * 100)

  return { score, weight, checks }
}

export async function runTechnicalAudit(url: string): Promise<AuditResult> {
  const startTime = Date.now()
  const baseUrl = getBaseUrl(url)

  const [html, robotsTxt, llmsTxt, psi] = await Promise.all([
    fetchText(url, 10000),
    fetchText(`${baseUrl}/robots.txt`, 5000),
    fetchText(`${baseUrl}/llms.txt`, 5000),
    fetchPageSpeedInsights(url),
  ])

  const response = await fetchWithTimeout(url, 10000)
  const ttfb = Date.now() - startTime

  const aiCrawlerAccess = checkAiCrawlerAccess(robotsTxt)
  const llmsTxtResult = checkLlmsTxt(llmsTxt)
  const schemaMarkup = checkSchemaMarkup(html || '')
  const metaTags = checkMetaTags(html || '')
  const securityHeaders = checkSecurityHeaders(response, url)
  const performance = checkPerformance(response, startTime - ttfb + Date.now() - startTime, psi)
  const contentStructure = checkContentStructure(html || '', url)

  const categories = {
    aiCrawlerAccess,
    llmsTxt: llmsTxtResult,
    schemaMarkup,
    metaTags,
    securityHeaders,
    performance,
    contentStructure,
  }

  const overallScore = Math.round(
    aiCrawlerAccess.score * aiCrawlerAccess.weight +
      llmsTxtResult.score * llmsTxtResult.weight +
      schemaMarkup.score * schemaMarkup.weight +
      metaTags.score * metaTags.weight +
      securityHeaders.score * securityHeaders.weight +
      performance.score * performance.weight +
      contentStructure.score * contentStructure.weight,
  )

  return {
    url,
    timestamp: new Date().toISOString(),
    overallScore,
    categories,
  }
}
