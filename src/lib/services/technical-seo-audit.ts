import { safeFetch } from '@/lib/utils/safe-fetch'

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
  const weight = 0.25
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

function checkPerformance(response: Response | null, startTime: number): AuditCategory {
  const weight = 0.05
  const checks: AuditCheck[] = []

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

  let score = 25
  if (ttfb < 500) score = 100
  else if (ttfb < 800) score = 75
  else if (ttfb < 1500) score = 50

  return { score, weight, checks }
}

export async function runTechnicalAudit(url: string): Promise<AuditResult> {
  const startTime = Date.now()
  const baseUrl = getBaseUrl(url)

  const [html, robotsTxt, llmsTxt] = await Promise.all([
    fetchText(url, 10000),
    fetchText(`${baseUrl}/robots.txt`, 5000),
    fetchText(`${baseUrl}/llms.txt`, 5000),
  ])

  const response = await fetchWithTimeout(url, 10000)
  const ttfb = Date.now() - startTime

  const aiCrawlerAccess = checkAiCrawlerAccess(robotsTxt)
  const llmsTxtResult = checkLlmsTxt(llmsTxt)
  const schemaMarkup = checkSchemaMarkup(html || '')
  const metaTags = checkMetaTags(html || '')
  const securityHeaders = checkSecurityHeaders(response, url)
  const performance = checkPerformance(response, startTime - ttfb + Date.now() - startTime)

  const categories = {
    aiCrawlerAccess,
    llmsTxt: llmsTxtResult,
    schemaMarkup,
    metaTags,
    securityHeaders,
    performance,
  }

  const overallScore = Math.round(
    aiCrawlerAccess.score * aiCrawlerAccess.weight +
      llmsTxtResult.score * llmsTxtResult.weight +
      schemaMarkup.score * schemaMarkup.weight +
      metaTags.score * metaTags.weight +
      securityHeaders.score * securityHeaders.weight +
      performance.score * performance.weight,
  )

  return {
    url,
    timestamp: new Date().toISOString(),
    overallScore,
    categories,
  }
}
