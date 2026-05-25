import { describe, it, expect } from 'vitest'
import {
  extractJsonLd,
  extractMicrodata,
  extractRdfa,
  extractAllSchemas,
  validateTypes,
  getFixSuggestions,
  determineOverallStatus,
  validateHtml,
  auditSoftwareApplication,
} from '../services/schema-validator'

const HTML_WITH_ALL_SCHEMAS = `<!doctype html>
<html>
<head>
  <title>Test Page</title>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme Corp","url":"https://acme.com"}</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Test Article","author":{"@type":"Person","name":"John Doe"}}</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is this?","acceptedAnswer":{"@type":"Answer","text":"It is a test."}}]}</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://acme.com/"}]}</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Acme"},{"@type":"WebSite","name":"Acme"}]}</script>
</head>
<body>
  <div itemscope itemtype="https://schema.org/Product">
    <span itemprop="name">Widget</span>
  </div>
  <div typeof="Article" vocab="https://schema.org/">
    <span property="headline">Microdata Article</span>
  </div>
</body>
</html>`

const HTML_NO_SCHEMA = `<!doctype html>
<html>
<head><title>No Schema</title></head>
<body><p>No schema here</p></body>
</html>`

const HTML_PARTIAL_SCHEMA = `<!doctype html>
<html>
<head>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme"}</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite"}</script>
</head>
<body></body>
</html>`

const REQUIRED_TYPES = ['Organization', 'Article', 'FAQPage', 'BreadcrumbList']

describe('extractJsonLd', () => {
  it('should extract JSON-LD schemas from HTML', () => {
    const result = extractJsonLd(HTML_WITH_ALL_SCHEMAS)
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((s) => s.source === 'json-ld')).toBe(true)

    const types = result.map((s) => s.type)
    expect(types).toContain('Organization')
    expect(types).toContain('Article')
    expect(types).toContain('FAQPage')
    expect(types).toContain('BreadcrumbList')
  })

  it('should return empty array for HTML without JSON-LD', () => {
    const result = extractJsonLd(HTML_NO_SCHEMA)
    expect(result).toEqual([])
  })

  it('should handle graph arrays', () => {
    const result = extractJsonLd(HTML_WITH_ALL_SCHEMAS)
    const hasGraphExtraction = result.some((s) => s.type === 'WebSite')
    expect(hasGraphExtraction).toBe(true)
  })
})

describe('extractMicrodata', () => {
  it('should extract microdata itemtypes', () => {
    const result = extractMicrodata(HTML_WITH_ALL_SCHEMAS)
    expect(result.some((s) => s.type === 'Product')).toBe(true)
    expect(result.every((s) => s.source === 'microdata')).toBe(true)
  })
})

describe('extractRdfa', () => {
  it('should extract RDFa typeof attributes', () => {
    const result = extractRdfa(HTML_WITH_ALL_SCHEMAS)
    expect(result.some((s) => s.type === 'Article')).toBe(true)
    expect(result.every((s) => s.source === 'rdfa')).toBe(true)
  })
})

describe('extractAllSchemas', () => {
  it('should combine all schema sources', () => {
    const result = extractAllSchemas(HTML_WITH_ALL_SCHEMAS)
    expect(result.length).toBeGreaterThan(0)

    const sources = new Set(result.map((s) => s.source))
    expect(sources.has('json-ld')).toBe(true)
    expect(sources.has('microdata')).toBe(true)
    expect(sources.has('rdfa')).toBe(true)
  })
})

describe('validateTypes', () => {
  it('should return pass for all required types present', () => {
    const schemas = extractAllSchemas(HTML_WITH_ALL_SCHEMAS)
    const results = validateTypes(schemas, REQUIRED_TYPES)

    const orgResult = results.find((r) => r.expectedType === 'Organization')
    expect(orgResult?.found).toBe(true)
    expect(orgResult?.severity).toBe('info')
  })

  it('should return critical for missing required types', () => {
    const schemas = extractAllSchemas(HTML_NO_SCHEMA)
    const results = validateTypes(schemas, REQUIRED_TYPES)

    const orgResult = results.find((r) => r.expectedType === 'Organization')
    expect(orgResult?.found).toBe(false)
    expect(orgResult?.severity).toBe('critical')
  })

  it('should return critical for missing types without similar match', () => {
    const html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script></head></html>`
    const schemas = extractAllSchemas(html)
    const results = validateTypes(schemas, ['BlogPosting'])

    const blogResult = results.find((r) => r.expectedType === 'BlogPosting')
    expect(blogResult?.found).toBe(false)
    expect(blogResult?.severity).toBe('critical')
  })
})

describe('getFixSuggestions', () => {
  it('should provide critical suggestions for missing types', () => {
    const schemas = extractAllSchemas(HTML_NO_SCHEMA)
    const validations = validateTypes(schemas, REQUIRED_TYPES)
    const suggestions = getFixSuggestions(validations)

    const criticalSuggestions = suggestions.filter((s) => s.severity === 'critical')
    expect(criticalSuggestions.length).toBeGreaterThan(0)
  })

  it('should sort suggestions by severity', () => {
    const schemas = extractAllSchemas(HTML_NO_SCHEMA)
    const validations = validateTypes(schemas, REQUIRED_TYPES)
    const suggestions = getFixSuggestions(validations)

    const severities = suggestions.map((s) => s.severity)
    const criticalIdx = severities.indexOf('critical')
    const warningIdx = severities.indexOf('warning')
    const infoIdx = severities.indexOf('info')

    if (criticalIdx !== -1 && warningIdx !== -1) {
      expect(criticalIdx).toBeLessThan(warningIdx)
    }
    if (warningIdx !== -1 && infoIdx !== -1) {
      expect(warningIdx).toBeLessThan(infoIdx)
    }
  })
})

describe('determineOverallStatus', () => {
  it('should return fail when critical issues exist', () => {
    const results: import('../services/schema-validator').ValidationResult[] = [
      {
        expectedType: 'Organization',
        found: false,
        foundTypes: [],
        severity: 'critical',
        message: '',
      },
    ]
    expect(determineOverallStatus(results)).toBe('fail')
  })

  it('should return warning when only warnings exist', () => {
    const results: import('../services/schema-validator').ValidationResult[] = [
      {
        expectedType: 'Organization',
        found: false,
        foundTypes: [],
        severity: 'warning',
        message: '',
      },
    ]
    expect(determineOverallStatus(results)).toBe('warning')
  })

  it('should return pass when all valid', () => {
    const results: import('../services/schema-validator').ValidationResult[] = [
      {
        expectedType: 'Organization',
        found: true,
        foundTypes: ['Organization'],
        severity: 'info',
        message: '',
      },
    ]
    expect(determineOverallStatus(results)).toBe('pass')
  })
})

describe('validateHtml', () => {
  it('should validate HTML and return complete response', async () => {
    const result = await validateHtml(HTML_WITH_ALL_SCHEMAS, 'https://acme.com')

    expect(result.url).toBe('https://acme.com')
    expect(result.extracted.length).toBeGreaterThan(0)
    expect(result.validations.length).toBeGreaterThan(0)
    expect(result.overall).toBe('pass')
  })

  it('should return fail for HTML without schemas', async () => {
    const result = await validateHtml(HTML_NO_SCHEMA)

    expect(result.overall).toBe('fail')
    const criticalSuggestions = result.suggestions.filter((s) => s.severity === 'critical')
    expect(criticalSuggestions.length).toBe(4)
  })

  it('should work with partial schemas', async () => {
    const result = await validateHtml(HTML_PARTIAL_SCHEMA)

    expect(result.overall).toBe('fail')
  })

  it('returns null softwareApplication when no SoftwareApplication schema is present', async () => {
    const result = await validateHtml(HTML_WITH_ALL_SCHEMAS)
    expect(result.softwareApplication).toBeNull()
  })
})

describe('auditSoftwareApplication', () => {
  const NOW = Date.parse('2026-05-25T00:00:00Z')

  it('returns null when no SoftwareApplication-family schema exists', () => {
    const schemas = extractAllSchemas(HTML_NO_SCHEMA)
    expect(auditSoftwareApplication(schemas, NOW)).toBeNull()
  })

  it('passes on a complete SoftwareApplication with fresh validity window', () => {
    const html = `<html><head>
      <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Acme CRM',
        applicationCategory: 'BusinessApplication',
        featureList: ['Pipeline', 'Reporting', 'Slack integration'],
        offers: {
          '@type': 'Offer',
          price: '29',
          priceCurrency: 'USD',
          priceValidUntil: '2026-12-31',
        },
      })}</script>
    </head></html>`
    const schemas = extractAllSchemas(html)
    const audit = auditSoftwareApplication(schemas, NOW)
    expect(audit).not.toBeNull()
    expect(audit!.status).toBe('pass')
  })

  it('fails when offers block is missing', () => {
    const html = `<html><head>
      <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Acme CRM',
        applicationCategory: 'BusinessApplication',
      })}</script>
    </head></html>`
    const schemas = extractAllSchemas(html)
    const audit = auditSoftwareApplication(schemas, NOW)
    expect(audit?.status).toBe('fail')
    expect(audit?.checks.some((c) => c.id === 'offers-present' && c.severity === 'critical')).toBe(
      true,
    )
  })

  it('warns when offers exist but priceCurrency is missing', () => {
    const html = `<html><head>
      <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        applicationCategory: 'BusinessApplication',
        offers: { '@type': 'Offer', price: '29' },
      })}</script>
    </head></html>`
    const audit = auditSoftwareApplication(extractAllSchemas(html), NOW)
    expect(audit?.status).toBe('warning')
    expect(
      audit?.checks.some((c) => c.id === 'price-currency-present' && c.severity === 'warning'),
    ).toBe(true)
  })

  it('flags a stale priceValidUntil as critical', () => {
    const html = `<html><head>
      <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        applicationCategory: 'BusinessApplication',
        offers: {
          '@type': 'Offer',
          price: '29',
          priceCurrency: 'USD',
          priceValidUntil: '2024-12-31',
        },
      })}</script>
    </head></html>`
    const audit = auditSoftwareApplication(extractAllSchemas(html), NOW)
    expect(audit?.status).toBe('fail')
    expect(
      audit?.checks.some((c) => c.id === 'price-validity-stale' && c.severity === 'critical'),
    ).toBe(true)
  })

  it('drills into @graph to find a SaaSApplication node', () => {
    const html = `<html><head>
      <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'Organization', name: 'Acme' },
          {
            '@type': 'SaaSApplication',
            applicationCategory: 'BusinessApplication',
            offers: {
              '@type': 'Offer',
              price: '49',
              priceCurrency: 'USD',
              priceValidUntil: '2027-01-01',
            },
          },
        ],
      })}</script>
    </head></html>`
    const audit = auditSoftwareApplication(extractAllSchemas(html), NOW)
    expect(audit?.status).toBe('pass')
  })
})
