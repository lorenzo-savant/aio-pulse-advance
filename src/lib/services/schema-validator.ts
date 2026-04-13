export type Severity = 'critical' | 'warning' | 'info'

export interface ExtractedSchema {
  type: string
  data: Record<string, unknown>
  source: 'json-ld' | 'microdata' | 'rdfa'
}

export interface ValidationResult {
  expectedType: string
  found: boolean
  foundTypes: string[]
  severity: Severity
  message: string
}

export interface FixSuggestion {
  type: string
  severity: Severity
  message: string
  suggestion: string
}

export interface SchemaValidationResponse {
  url?: string
  extracted: ExtractedSchema[]
  validations: ValidationResult[]
  suggestions: FixSuggestion[]
  overall: 'pass' | 'fail' | 'warning'
}

function extractScripts(html: string): string[] {
  const jsonLdScripts: string[] = []
  const regex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    if (match[1]) {
      jsonLdScripts.push(match[1].trim())
    }
  }
  return jsonLdScripts
}

function parseJsonLd(scriptContent: string): Record<string, unknown> | null {
  try {
    return JSON.parse(scriptContent)
  } catch {
    return null
  }
}

function getSchemaType(schema: Record<string, unknown>): string[] {
  const types: string[] = []

  const extractType = (obj: Record<string, unknown>) => {
    if (obj['@type']) {
      const t = obj['@type']
      if (typeof t === 'string') {
        types.push(t)
      } else if (Array.isArray(t)) {
        t.forEach((item) => {
          if (typeof item === 'string') types.push(item)
        })
      }
    }
  }

  extractType(schema)

  if (schema['@graph'] && Array.isArray(schema['@graph'])) {
    schema['@graph'].forEach((item: unknown) => {
      if (typeof item === 'object' && item !== null) {
        extractType(item as Record<string, unknown>)
      }
    })
  }

  return types
}

function extractMicrodataFromHtml(html: string): ExtractedSchema[] {
  const results: ExtractedSchema[] = []

  const itemtypeRegex = /itemtype=["']https?:\/\/schema\.org\/(\w+)["']/gi
  const itemscopeRegex = /itemscope/i

  let match
  const seen = new Set<string>()

  while ((match = itemtypeRegex.exec(html)) !== null) {
    const type = match[1]
    if (type && !seen.has(type)) {
      seen.add(type)
      results.push({
        type,
        data: { source: 'microdata extraction' },
        source: 'microdata',
      })
    }
  }

  return results
}

function extractRdfaFromHtml(html: string): ExtractedSchema[] {
  const results: ExtractedSchema[] = []

  const vocabRegex = /vocab=["']https?:\/\/schema\.org\/(\w+)["']/gi
  const typeofRegex = /typeof=["'](\w+)["']/gi

  let match
  const seen = new Set<string>()

  while ((match = typeofRegex.exec(html)) !== null) {
    const type = match[1]
    if (type && !seen.has(type)) {
      seen.add(type)
      results.push({
        type,
        data: { source: 'rdfa extraction' },
        source: 'rdfa',
      })
    }
  }

  return results
}

export function extractJsonLd(html: string): ExtractedSchema[] {
  const results: ExtractedSchema[] = []
  const scripts = extractScripts(html)

  for (const script of scripts) {
    const parsed = parseJsonLd(script)
    if (parsed) {
      const types = getSchemaType(parsed)
      for (const type of types) {
        results.push({
          type,
          data: parsed,
          source: 'json-ld',
        })
      }
    }
  }

  return results
}

export function extractMicrodata(html: string): ExtractedSchema[] {
  return extractMicrodataFromHtml(html)
}

export function extractRdfa(html: string): ExtractedSchema[] {
  return extractRdfaFromHtml(html)
}

export function extractAllSchemas(html: string): ExtractedSchema[] {
  const jsonLd = extractJsonLd(html)
  const microdata = extractMicrodata(html)
  const rdfa = extractRdfa(html)

  return [...jsonLd, ...microdata, ...rdfa]
}

export function validateTypes(
  schemas: ExtractedSchema[],
  requiredTypes: string[],
): ValidationResult[] {
  const results: ValidationResult[] = []
  const foundTypes = schemas.map((s) => s.type)

  for (const requiredType of requiredTypes) {
    const found = foundTypes.includes(requiredType)
    const matchingSchemas = schemas.filter((s) => s.type === requiredType)

    let severity: Severity = 'critical'
    let message: string

    if (found) {
      severity = 'info'
      message = `Required type "${requiredType}" is present`
    } else {
      const similarTypes = foundTypes.filter(
        (t) =>
          t.toLowerCase().includes(requiredType.toLowerCase()) ||
          requiredType.toLowerCase().includes(t.toLowerCase()),
      )
      if (similarTypes.length > 0) {
        severity = 'warning'
        message = `Missing required type "${requiredType}". Found similar: ${similarTypes.join(', ')}`
      } else {
        severity = 'critical'
        message = `Missing required type "${requiredType}"`
      }
    }

    results.push({
      expectedType: requiredType,
      found,
      foundTypes: matchingSchemas.map((s) => s.type),
      severity,
      message,
    })
  }

  const unexpectedTypes = foundTypes.filter(
    (t) => !requiredTypes.includes(t) && !['WebPage', 'Thing', 'Entity'].includes(t),
  )

  if (unexpectedTypes.length > 0) {
    results.push({
      expectedType: 'optional',
      found: true,
      foundTypes: unexpectedTypes,
      severity: 'info',
      message: `Additional schema types found: ${unexpectedTypes.join(', ')}`,
    })
  }

  return results
}

export function getFixSuggestions(results: ValidationResult[]): FixSuggestion[] {
  const suggestions: FixSuggestion[] = []

  for (const result of results) {
    if (!result.found && result.severity === 'critical') {
      suggestions.push({
        type: result.expectedType,
        severity: 'critical',
        message: `Missing required schema type: ${result.expectedType}`,
        suggestion: `Add JSON-LD schema with "@type": "${result.expectedType}" in a <script type="application/ld+json"> tag`,
      })
    } else if (!result.found && result.severity === 'warning') {
      suggestions.push({
        type: result.expectedType,
        severity: 'warning',
        message: result.message,
        suggestion: `Check schema type spelling. Expected "${result.expectedType}", found: ${result.foundTypes.join(', ')}`,
      })
    }
  }

  const hasOrganization = results.some((r) => r.expectedType === 'Organization' && r.found)
  const hasArticle = results.some((r) => r.expectedType === 'Article' && r.found)
  const hasFaqPage = results.some((r) => r.expectedType === 'FAQPage' && r.found)
  const hasBreadcrumb = results.some((r) => r.expectedType === 'BreadcrumbList' && r.found)

  if (!hasOrganization) {
    suggestions.push({
      type: 'Organization',
      severity: 'info',
      message: 'Organization schema improves brand visibility in search results',
      suggestion: 'Add Organization schema with name, url, logo, and contactPoint properties',
    })
  }

  if (!hasArticle) {
    suggestions.push({
      type: 'Article',
      severity: 'info',
      message: 'Article schema helps content appear in rich snippets',
      suggestion: 'Add Article schema with headline, author, datePublished, and image properties',
    })
  }

  if (!hasFaqPage) {
    suggestions.push({
      type: 'FAQPage',
      severity: 'info',
      message: 'FAQ schema can trigger FAQ rich results in Google',
      suggestion: 'Add FAQPage schema with mainEntity containing Question and Answer objects',
    })
  }

  if (!hasBreadcrumb) {
    suggestions.push({
      type: 'BreadcrumbList',
      severity: 'info',
      message: 'BreadcrumbList schema improves navigation in search results',
      suggestion: 'Add BreadcrumbList schema with itemListElement containing ListItem objects',
    })
  }

  return suggestions.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 }
    return order[a.severity] - order[b.severity]
  })
}

export function determineOverallStatus(results: ValidationResult[]): 'pass' | 'fail' | 'warning' {
  const hasCritical = results.some((r) => r.severity === 'critical' && !r.found)
  const hasWarning = results.some((r) => r.severity === 'warning' && !r.found)

  if (hasCritical) return 'fail'
  if (hasWarning) return 'warning'
  return 'pass'
}

export async function validateHtml(
  html: string,
  url?: string,
  requiredTypes: string[] = ['Organization', 'Article', 'FAQPage', 'BreadcrumbList'],
): Promise<SchemaValidationResponse> {
  const extracted = extractAllSchemas(html)
  const validations = validateTypes(extracted, requiredTypes)
  const suggestions = getFixSuggestions(validations)
  const overall = determineOverallStatus(validations)

  return {
    url,
    extracted,
    validations,
    suggestions,
    overall,
  }
}
