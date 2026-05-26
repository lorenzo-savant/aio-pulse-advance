import type { AuditCheck, SiteAuditResult } from './types'
import { safeFetchText } from '@/lib/utils/safe-fetch'

export async function auditSite(url: string): Promise<SiteAuditResult> {
  const checks: AuditCheck[] = []

  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`

  try {
    const { text: html, response } = await safeFetchText(normalizedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'AIO-Pulse-Audit-Bot/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
    })

    const headers = response.headers

    checks.push(...runSeoChecks(normalizedUrl, html, headers))
    checks.push(...runAeoChecks(normalizedUrl, html))
    checks.push(...runEeatChecks(normalizedUrl, html))
    checks.push(...runTechnicalChecks(normalizedUrl, html, headers))
    checks.push(...runFreshnessChecks(normalizedUrl, html))
  } catch (err) {
    checks.push({
      id: 'site-reachable',
      category: 'technical',
      name: 'Site Reachable',
      description: 'The site could not be reached for auditing',
      score: 0,
      status: 'fail',
      fix: 'Ensure the site is publicly accessible and not blocked by firewalls',
      priority: 'critical',
      impact: 10,
    })
  }

  const categoryScores = calculateCategoryScores(checks)
  const geoCitationScore = calculateGeoCitationScore(checks)

  return {
    url: normalizedUrl,
    auditedAt: new Date().toISOString(),
    overallScore: Math.round((categoryScores.overall || 0) * 10) / 10,
    seoScore: categoryScores.seo || 0,
    aeoScore: categoryScores.aeo || 0,
    eeatScore: categoryScores.eeat || 0,
    technicalScore: categoryScores.technical || 0,
    freshnessScore: categoryScores.freshness || 0,
    geoCitationScore,
    checks,
    summary: generateAuditSummary(categoryScores, checks),
  }
}

export async function auditArticle(url: string): Promise<SiteAuditResult> {
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`
  const checks: AuditCheck[] = []

  try {
    const { text: html, response } = await safeFetchText(normalizedUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'AIO-Pulse-Audit-Bot/1.0' },
      timeout: 15000,
    })

    const headers = response.headers

    checks.push(...runArticleSeoChecks(normalizedUrl, html, headers))
    checks.push(...runArticleAeoChecks(normalizedUrl, html))
    checks.push(...runArticleEeatChecks(normalizedUrl, html))
  } catch (err) {
    checks.push({
      id: 'article-reachable',
      category: 'technical',
      name: 'Article Reachable',
      description: 'The article could not be reached',
      score: 0,
      status: 'fail',
      priority: 'critical',
      impact: 10,
    })
  }

  const categoryScores = calculateCategoryScores(checks)
  const geoCitationScore = calculateGeoCitationScore(checks)

  return {
    url: normalizedUrl,
    auditedAt: new Date().toISOString(),
    overallScore: Math.round((categoryScores.overall || 0) * 10) / 10,
    seoScore: categoryScores.seo || 0,
    aeoScore: categoryScores.aeo || 0,
    eeatScore: categoryScores.eeat || 0,
    technicalScore: categoryScores.technical || 0,
    freshnessScore: categoryScores.freshness || 0,
    geoCitationScore,
    checks,
    summary: generateAuditSummary(categoryScores, checks),
  }
}

function runSeoChecks(url: string, html: string, headers: Headers): AuditCheck[] {
  const checks: AuditCheck[] = []

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch?.[1]?.trim() || ''
  checks.push({
    id: 'seo-title',
    category: 'seo',
    name: 'Title Tag',
    description: `Title: "${title}" (${title.length} chars)`,
    score: title.length >= 30 && title.length <= 60 ? 10 : title.length > 0 ? 5 : 0,
    status: title.length >= 30 && title.length <= 60 ? 'pass' : title.length > 0 ? 'warn' : 'fail',
    fix:
      title.length === 0
        ? 'Add a <title> tag between 30-60 characters'
        : title.length < 30
          ? 'Expand title to 30-60 characters'
          : 'Shorten title to 60 characters max',
    priority: title.length === 0 ? 'critical' : 'high',
    impact: 8,
  })

  const metaDescMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)
  const metaDesc = metaDescMatch?.[1]?.trim() || ''
  checks.push({
    id: 'seo-meta-description',
    category: 'seo',
    name: 'Meta Description',
    description: `Description: "${metaDesc.slice(0, 80)}..." (${metaDesc.length} chars)`,
    score: metaDesc.length >= 120 && metaDesc.length <= 160 ? 10 : metaDesc.length > 0 ? 5 : 0,
    status:
      metaDesc.length >= 120 && metaDesc.length <= 160
        ? 'pass'
        : metaDesc.length > 0
          ? 'warn'
          : 'fail',
    fix:
      metaDesc.length === 0
        ? 'Add a meta description between 120-160 characters'
        : 'Optimize meta description length to 120-160 characters',
    priority: metaDesc.length === 0 ? 'high' : 'medium',
    impact: 7,
  })

  const h1Matches = html.match(/<h1[^>]*>([^<]+)<\/h1>/gi) || []
  const h1Count = h1Matches.length
  checks.push({
    id: 'seo-h1',
    category: 'seo',
    name: 'H1 Tag',
    description: `${h1Count} H1 tag(s) found`,
    score: h1Count === 1 ? 10 : h1Count === 0 ? 0 : 5,
    status: h1Count === 1 ? 'pass' : h1Count === 0 ? 'fail' : 'warn',
    fix: h1Count === 0 ? 'Add exactly one H1 tag per page' : 'Use only one H1 tag per page',
    priority: h1Count === 0 ? 'high' : 'medium',
    impact: 6,
  })

  const canonicalMatch =
    html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ||
    html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)
  const hasCanonical = !!canonicalMatch
  checks.push({
    id: 'seo-canonical',
    category: 'seo',
    name: 'Canonical URL',
    description: hasCanonical ? `Canonical: ${canonicalMatch![1]}` : 'No canonical URL found',
    score: hasCanonical ? 10 : 0,
    status: hasCanonical ? 'pass' : 'fail',
    fix: 'Add a <link rel="canonical"> tag to prevent duplicate content issues',
    priority: 'medium',
    impact: 5,
  })

  const ogTitleMatch = html.match(
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
  )
  const hasOgTags = !!ogTitleMatch
  checks.push({
    id: 'seo-open-graph',
    category: 'seo',
    name: 'Open Graph Tags',
    description: hasOgTags ? 'Open Graph tags present' : 'No Open Graph tags found',
    score: hasOgTags ? 10 : 0,
    status: hasOgTags ? 'pass' : 'warn',
    fix: 'Add og:title, og:description, and og:image meta tags for social sharing',
    priority: 'low',
    impact: 3,
  })

  const hreflangMatch = html.match(/hreflang=/gi) || []
  const hasHreflang = hreflangMatch.length > 0
  checks.push({
    id: 'seo-hreflang',
    category: 'seo',
    name: 'Hreflang Tags',
    description: `${hreflangMatch.length} hreflang reference(s) found`,
    score: hasHreflang ? 10 : 5,
    status: hasHreflang ? 'pass' : 'warn',
    fix: 'Add hreflang tags if the site serves multiple languages/regions',
    priority: 'low',
    impact: 2,
  })

  return checks
}

function runAeoChecks(url: string, html: string): AuditCheck[] {
  const checks: AuditCheck[] = []

  const hasSchemaOrg = html.includes('schema.org') || html.includes('application/ld+json')
  checks.push({
    id: 'aeo-structured-data',
    category: 'aeo',
    name: 'Structured Data (Schema.org)',
    description: hasSchemaOrg ? 'Schema.org markup detected' : 'No structured data found',
    score: hasSchemaOrg ? 10 : 0,
    status: hasSchemaOrg ? 'pass' : 'fail',
    fix: 'Add JSON-LD structured data (Article, Organization, FAQPage, HowTo) to help AI engines understand content',
    priority: 'critical',
    impact: 9,
  })

  const faqMatch = html.match(/FAQPage|Question|Answer/gi) || []
  const hasFaq = faqMatch.length >= 3
  checks.push({
    id: 'aeo-faq',
    category: 'aeo',
    name: 'FAQ Structure',
    description: `${faqMatch.length} FAQ-related element(s) found`,
    score: hasFaq ? 10 : faqMatch.length > 0 ? 5 : 0,
    status: hasFaq ? 'pass' : faqMatch.length > 0 ? 'warn' : 'fail',
    fix: 'Add FAQPage schema with clear question-answer pairs for AI Overview citations',
    priority: 'high',
    impact: 8,
  })

  const hasHowTo = html.includes('HowTo') || html.includes('how-to')
  checks.push({
    id: 'aeo-howto',
    category: 'aeo',
    name: 'How-To Content',
    description: hasHowTo ? 'How-To content detected' : 'No How-To structure found',
    score: hasHowTo ? 10 : 3,
    status: hasHowTo ? 'pass' : 'warn',
    fix: 'Add HowTo schema for step-by-step content to increase AI citation chances',
    priority: 'medium',
    impact: 6,
  })

  const hasDirectAnswers = /<p[^>]*>(.{20,200}?)<\/p>/gi.test(html)
  const paragraphCount = (html.match(/<p[^>]*>/gi) || []).length
  checks.push({
    id: 'aeo-direct-answers',
    category: 'aeo',
    name: 'Direct Answer Format',
    description: `${paragraphCount} paragraph(s) - ${hasDirectAnswers ? 'concise answers present' : 'may lack direct answers'}`,
    score: hasDirectAnswers && paragraphCount >= 3 ? 10 : hasDirectAnswers ? 7 : 3,
    status: hasDirectAnswers && paragraphCount >= 3 ? 'pass' : 'warn',
    fix: 'Write clear, concise answers (40-60 words) at the start of sections for AI extraction',
    priority: 'high',
    impact: 8,
  })

  const hasDefinitionList = html.includes('<dl') || html.includes('<dt') || html.includes('<dd')
  const hasDefinitiveContent = /is defined as|refers to|means that|in other words/gi.test(html)
  checks.push({
    id: 'aeo-definitive-content',
    category: 'aeo',
    name: 'Definitive Content',
    description: hasDefinitiveContent
      ? 'Definitive statements detected'
      : 'No definitive statements found',
    score: hasDefinitiveContent ? 10 : hasDefinitionList ? 7 : 2,
    status: hasDefinitiveContent ? 'pass' : 'warn',
    fix: 'Use definitive language ("X is...", "Y refers to...") to increase AI citation probability',
    priority: 'medium',
    impact: 7,
  })

  return checks
}

function runEeatChecks(url: string, html: string): AuditCheck[] {
  const checks: AuditCheck[] = []

  const hasAuthorInfo = /author|byline|written by|posted by/gi.test(html)
  const hasAuthorSchema = html.includes('"author"') || html.includes('"Person"')
  checks.push({
    id: 'eeat-author',
    category: 'eeat',
    name: 'Author Attribution',
    description: hasAuthorInfo ? 'Author information present' : 'No author attribution found',
    score: hasAuthorSchema ? 10 : hasAuthorInfo ? 7 : 0,
    status: hasAuthorSchema ? 'pass' : hasAuthorInfo ? 'warn' : 'fail',
    fix: 'Add clear author attribution with author schema markup for E-E-A-T compliance',
    priority: 'high',
    impact: 8,
  })

  const hasAboutPage =
    html.includes('/about') || html.includes('about us') || html.includes('about page')
  checks.push({
    id: 'eeat-about-page',
    category: 'eeat',
    name: 'About Page',
    description: hasAboutPage ? 'About page link detected' : 'No about page link found',
    score: hasAboutPage ? 10 : 0,
    status: hasAboutPage ? 'pass' : 'warn',
    fix: 'Link to an About page with company/author credentials and expertise',
    priority: 'medium',
    impact: 5,
  })

  const hasContactInfo = /contact|email|phone|address/gi.test(html)
  checks.push({
    id: 'eeat-contact',
    category: 'eeat',
    name: 'Contact Information',
    description: hasContactInfo ? 'Contact information present' : 'No contact info found',
    score: hasContactInfo ? 10 : 0,
    status: hasContactInfo ? 'pass' : 'fail',
    fix: 'Add clear contact information (email, phone, address) for trust signals',
    priority: 'high',
    impact: 7,
  })

  const hasCitations = /<cite|references|sources|bibliography|doi\.org|scholar\.google/gi.test(html)
  checks.push({
    id: 'eeat-citations',
    category: 'eeat',
    name: 'Source Citations',
    description: hasCitations ? 'Source citations detected' : 'No citations found',
    score: hasCitations ? 10 : 2,
    status: hasCitations ? 'pass' : 'warn',
    fix: 'Cite authoritative sources (studies, research, expert quotes) to boost E-E-A-T',
    priority: 'medium',
    impact: 6,
  })

  const hasHttps = url.startsWith('https')
  checks.push({
    id: 'eeat-https',
    category: 'eeat',
    name: 'HTTPS Security',
    description: hasHttps ? 'HTTPS enabled' : 'HTTP only',
    score: hasHttps ? 10 : 0,
    status: hasHttps ? 'pass' : 'fail',
    fix: 'Migrate to HTTPS for security and trust signals',
    priority: 'critical',
    impact: 9,
  })

  const hasPrivacyPolicy = html.includes('privacy') && html.includes('policy')
  checks.push({
    id: 'eeat-privacy',
    category: 'eeat',
    name: 'Privacy Policy',
    description: hasPrivacyPolicy ? 'Privacy policy link detected' : 'No privacy policy found',
    score: hasPrivacyPolicy ? 10 : 0,
    status: hasPrivacyPolicy ? 'pass' : 'warn',
    fix: 'Add a privacy policy page for trust and compliance',
    priority: 'medium',
    impact: 4,
  })

  return checks
}

function runTechnicalChecks(url: string, html: string, headers: Headers): AuditCheck[] {
  const checks: AuditCheck[] = []

  const contentType = headers.get('content-type') || ''
  const isHtml = contentType.includes('text/html')
  checks.push({
    id: 'tech-content-type',
    category: 'technical',
    name: 'Content Type',
    description: `Content-Type: ${contentType}`,
    score: isHtml ? 10 : 5,
    status: isHtml ? 'pass' : 'warn',
    fix: 'Ensure proper Content-Type header is set to text/html',
    priority: 'low',
    impact: 2,
  })

  const hasRobotsMeta =
    html.includes('robots') && (html.includes('noindex') || html.includes('index'))
  const robotsHeader = headers.get('x-robots-tag')
  const isIndexable = !html.includes('noindex') && !robotsHeader?.includes('noindex')
  checks.push({
    id: 'tech-indexable',
    category: 'technical',
    name: 'Page Indexable',
    description: isIndexable ? 'Page is indexable' : 'Page may be blocked from indexing',
    score: isIndexable ? 10 : 0,
    status: isIndexable ? 'pass' : 'fail',
    fix: 'Remove noindex directives if the page should appear in search results',
    priority: 'critical',
    impact: 10,
  })

  const hasViewport = html.includes('viewport')
  checks.push({
    id: 'tech-mobile',
    category: 'technical',
    name: 'Mobile Viewport',
    description: hasViewport ? 'Viewport meta tag present' : 'No viewport tag found',
    score: hasViewport ? 10 : 0,
    status: hasViewport ? 'pass' : 'fail',
    fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    priority: 'high',
    impact: 7,
  })

  const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i)
  const hasLang = !!langMatch
  checks.push({
    id: 'tech-lang',
    category: 'technical',
    name: 'HTML Lang Attribute',
    description: hasLang ? `Language: ${langMatch![1]}` : 'No lang attribute on <html>',
    score: hasLang ? 10 : 0,
    status: hasLang ? 'pass' : 'warn',
    fix: 'Add lang attribute to <html> tag (e.g., <html lang="en">)',
    priority: 'low',
    impact: 3,
  })

  const imgMatches = html.match(/<img[^>]*>/gi) || []
  const imgWithoutAlt = imgMatches.filter((img) => !img.includes('alt=')).length
  checks.push({
    id: 'tech-images-alt',
    category: 'technical',
    name: 'Image Alt Text',
    description: `${imgWithoutAlt}/${imgMatches.length} images missing alt text`,
    score: imgWithoutAlt === 0 ? 10 : imgMatches.length > 0 ? Math.max(0, 10 - imgWithoutAlt) : 10,
    status: imgWithoutAlt === 0 ? 'pass' : imgWithoutAlt <= 2 ? 'warn' : 'fail',
    fix: 'Add descriptive alt text to all images for accessibility and AI image understanding',
    priority: imgWithoutAlt > 5 ? 'high' : 'medium',
    impact: 5,
  })

  const hasFavicon = html.includes('favicon') || html.includes('icon')
  checks.push({
    id: 'tech-favicon',
    category: 'technical',
    name: 'Favicon',
    description: hasFavicon ? 'Favicon detected' : 'No favicon found',
    score: hasFavicon ? 10 : 3,
    status: hasFavicon ? 'pass' : 'warn',
    fix: 'Add a favicon for brand recognition in browser tabs and bookmarks',
    priority: 'low',
    impact: 1,
  })

  return checks
}

function runFreshnessChecks(url: string, html: string): AuditCheck[] {
  const checks: AuditCheck[] = []

  const datePublishedMatch =
    html.match(/"datePublished"\s*:\s*"([^"]+)"/i) ||
    html.match(/datePublished["']\s*content=["']([^"']+)["']/i)
  const dateModifiedMatch =
    html.match(/"dateModified"\s*:\s*"([^"]+)"/i) ||
    html.match(/dateModified["']\s*content=["']([^"']+)["']/i)

  const hasDatePublished = !!datePublishedMatch
  const hasDateModified = !!dateModifiedMatch

  checks.push({
    id: 'fresh-date-published',
    category: 'freshness',
    name: 'Date Published',
    description: hasDatePublished
      ? `Published: ${datePublishedMatch![1]}`
      : 'No publication date found',
    score: hasDatePublished ? 10 : 0,
    status: hasDatePublished ? 'pass' : 'fail',
    fix: 'Add datePublished in JSON-LD or meta tags for content freshness signals',
    priority: 'high',
    impact: 7,
  })

  checks.push({
    id: 'fresh-date-modified',
    category: 'freshness',
    name: 'Date Modified',
    description: hasDateModified
      ? `Modified: ${dateModifiedMatch![1]}`
      : 'No modification date found',
    score: hasDateModified ? 10 : 3,
    status: hasDateModified ? 'pass' : 'warn',
    fix: 'Add dateModified to show content is kept up-to-date',
    priority: 'medium',
    impact: 5,
  })

  if (hasDateModified && dateModifiedMatch?.[1]) {
    const modifiedDate = new Date(dateModifiedMatch[1])
    const daysSinceModified = Math.floor(
      (Date.now() - modifiedDate.getTime()) / (1000 * 60 * 60 * 24),
    )
    const isRecent = daysSinceModified < 90

    checks.push({
      id: 'fresh-content-age',
      category: 'freshness',
      name: 'Content Recency',
      description: `Last modified ${daysSinceModified} days ago`,
      score: isRecent ? 10 : daysSinceModified < 180 ? 7 : daysSinceModified < 365 ? 4 : 0,
      status: isRecent ? 'pass' : daysSinceModified < 180 ? 'warn' : 'fail',
      fix:
        daysSinceModified >= 365
          ? 'Content is over a year old. Update with current information'
          : 'Consider updating content to maintain freshness signals',
      priority: daysSinceModified >= 365 ? 'high' : 'medium',
      impact: 6,
    })
  }

  const hasTimeElement = html.includes('<time') || html.includes('datetime=')
  checks.push({
    id: 'fresh-time-element',
    category: 'freshness',
    name: 'Time Element',
    description: hasTimeElement ? '<time> element detected' : 'No <time> element found',
    score: hasTimeElement ? 10 : 3,
    status: hasTimeElement ? 'pass' : 'warn',
    fix: 'Use <time datetime="..."> for machine-readable dates',
    priority: 'low',
    impact: 3,
  })

  return checks
}

function runArticleSeoChecks(url: string, html: string, headers: Headers): AuditCheck[] {
  return [...runSeoChecks(url, html, headers), ...runFreshnessChecks(url, html)]
}

function runArticleAeoChecks(url: string, html: string): AuditCheck[] {
  return runAeoChecks(url, html)
}

function runArticleEeatChecks(url: string, html: string): AuditCheck[] {
  return runEeatChecks(url, html)
}

function calculateCategoryScores(checks: AuditCheck[]): Record<string, number> {
  const categories = ['seo', 'aeo', 'eeat', 'technical', 'freshness']
  const scores: Record<string, number> = {}

  for (const cat of categories) {
    const catChecks = checks.filter((c) => c.category === cat)
    if (catChecks.length === 0) {
      scores[cat] = 0
      continue
    }
    const total = catChecks.reduce((sum, c) => sum + c.score, 0)
    scores[cat] = Math.round((total / (catChecks.length * 10)) * 100) / 10
  }

  scores.overall =
    ((scores.seo || 0) +
      (scores.aeo || 0) +
      (scores.eeat || 0) +
      (scores.technical || 0) +
      (scores.freshness || 0)) /
    5

  return scores
}

function calculateGeoCitationScore(checks: AuditCheck[]): number {
  const geoFactors = {
    semanticAuthority: getFactorScore(checks, [
      'aeo-structured-data',
      'aeo-definitive-content',
      'aeo-faq',
    ]),
    sourceAttribution: getFactorScore(checks, ['eeat-citations', 'eeat-author', 'eeat-about-page']),
    contentFreshness: getFactorScore(checks, [
      'fresh-date-published',
      'fresh-date-modified',
      'fresh-content-age',
    ]),
    structuredData: getFactorScore(checks, ['aeo-structured-data', 'aeo-faq', 'aeo-howto']),
    entitySalience: getFactorScore(checks, ['seo-title', 'seo-h1', 'aeo-direct-answers']),
    trustSignals: getFactorScore(checks, ['eeat-https', 'eeat-contact', 'eeat-privacy']),
  }

  const weights = {
    semanticAuthority: 0.25,
    sourceAttribution: 0.2,
    contentFreshness: 0.15,
    structuredData: 0.2,
    entitySalience: 0.1,
    trustSignals: 0.1,
  }

  let score = 0
  for (const [factor, value] of Object.entries(geoFactors)) {
    const weight = weights[factor as keyof typeof weights] || 0
    score += value * weight
  }

  return Math.round(score * 10) / 10
}

function getFactorScore(checks: AuditCheck[], checkIds: string[]): number {
  const relevant = checks.filter((c) => checkIds.includes(c.id))
  if (relevant.length === 0) return 0
  const total = relevant.reduce((sum, c) => sum + c.score, 0)
  return total / (relevant.length * 10)
}

function generateAuditSummary(scores: Record<string, number>, checks: AuditCheck[]): string {
  const failing = checks.filter((c) => c.status === 'fail').length
  const warning = checks.filter((c) => c.status === 'warn').length
  const passing = checks.filter((c) => c.status === 'pass').length

  const weakest = Object.entries(scores)
    .filter(([k]) => k !== 'overall')
    .sort((a, b) => a[1] - b[1])[0]

  return `Audit complete: ${passing} passing, ${warning} warnings, ${failing} failing. Overall score: ${scores.overall}/10. Weakest area: ${weakest?.[0]} (${weakest?.[1]}/10).`
}
