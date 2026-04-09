export interface BrandIntel {
  name: string
  description: string
  industry: string | null
  foundingYear: string | null
  headquarters: string | null
  leadership: string[]
  products: string[]
  services: string[]
  businessModel: 'B2C' | 'B2B' | 'B2B2C' | 'C2C' | 'Unknown'
  keywords: string[]
  competitors: string[]
  website: string
  confidence: number
}

export interface DomainAnalysisResult {
  domain: string
  brandIntel: BrandIntel
  techStack: string[]
  seoMetrics: {
    pageTitle: string
    metaDescription: string
    headings: string[]
    linksCount: number
    imagesCount: number
  }
  sentiment: {
    label: 'positive' | 'negative' | 'neutral'
    score: number
    confidence: number
  }
  analysisMode: 'full' | 'quick'
  analyzedAt: string
}

const isPrivateIp = (ip: string): boolean => {
  const parts = ip.split('.').map(Number)
  if (parts.length === 4) {
    const [a, b = 0] = parts
    if (a === 127 || a === 0 || a === 10) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true
  }
  return false
}

const isSafeUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    if (parsed.port && !['80', '443', '8080', '8443'].includes(parsed.port)) return false
    if (isPrivateIp(parsed.hostname)) return false
    const blockedHostnames = [
      'localhost',
      'metadata.google.internal',
      '169.254.169.254',
      'metadata.azure.com',
    ]
    if (blockedHostnames.includes(parsed.hostname)) return false
    return true
  } catch {
    return false
  }
}

export async function fetchHtmlContent(url: string): Promise<string> {
  if (!isSafeUrl(url)) {
    throw new Error('URL is not allowed for security reasons')
  }

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AIO-Pulse/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`)
  }

  return res.text()
}

export function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 15000)
}

export function extractMetaInfo(html: string): { title: string; description: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
  const descMatchAlt = html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
  )

  return {
    title: titleMatch?.[1]?.trim() || '',
    description: descMatch?.[1] || descMatchAlt?.[1] || '',
  }
}

export function extractHeadings(html: string): string[] {
  const headings: string[] = []
  const h1Matches = html.matchAll(/<h1[^>]*>([^<]+)<\/h1>/gi)
  const h2Matches = html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gi)

  for (const match of h1Matches) {
    headings.push(match[1]?.trim() || '')
  }
  for (const match of h2Matches) {
    headings.push(match[1]?.trim() || '')
  }

  return [...new Set(headings)].slice(0, 20)
}

export function extractLinks(html: string): { href: string; text: string }[] {
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi
  const links: { href: string; text: string }[] = []

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1] || ''
    const text = match[2]?.replace(/\s+/g, ' ').trim() || ''
    if (href && text) {
      links.push({ href, text })
    }
  }

  return links
}

export function extractImages(html: string): string[] {
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi
  const images: string[] = []

  for (const match of html.matchAll(imgRegex)) {
    if (match[1]) {
      images.push(match[1])
    }
  }

  return images
}

export function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'shall',
    'can',
    'need',
    'dare',
    'ought',
    'used',
    'this',
    'that',
    'these',
    'those',
    'i',
    'you',
    'he',
    'she',
    'it',
    'we',
    'they',
    'what',
    'which',
    'who',
    'whom',
    'whose',
  ])

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w))

  const frequency: Record<string, number> = {}
  for (const word of words) {
    frequency[word] = (frequency[word] || 0) + 1
  }

  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word)
}

export function detectTechStack(html: string): string[] {
  const techPatterns: [RegExp, string][] = [
    [/react|reactjs|react\.js/i, 'React'],
    [/next\.js|nextjs|next-js/i, 'Next.js'],
    [/vue\.js|vuejs|vujs/i, 'Vue.js'],
    [/angular/i, 'Angular'],
    [/tailwind/i, 'Tailwind CSS'],
    [/bootstrap/i, 'Bootstrap'],
    [/wordpress|wp-content/i, 'WordPress'],
    [/shopify/i, 'Shopify'],
    [/wp-json\/wp\/v2/i, 'WordPress REST API'],
    [/gatsby/i, 'Gatsby'],
    [/strapi/i, 'Strapi'],
    [/hubspot/i, 'HubSpot'],
    [/stripe/i, 'Stripe'],
    [/analytics\.google\.com|googletagmanager/i, 'Google Analytics'],
    [/facebook\.com\/tr|fbevents/i, 'Facebook Pixel'],
    [/cloudflare|cf-/i, 'Cloudflare'],
    [/amazonaws|s3\.amazonaws/i, 'AWS'],
    [/googleapis/i, 'Google Cloud'],
    [/fonts\.googleapis|fonts\.gstatic/i, 'Google Fonts'],
  ]

  const detected: string[] = []
  for (const [pattern, tech] of techPatterns) {
    if (pattern.test(html)) {
      detected.push(tech)
    }
  }

  return [...new Set(detected)]
}

export function analyzeSentiment(text: string): {
  label: 'positive' | 'negative' | 'neutral'
  score: number
  confidence: number
} {
  const positiveWords = [
    'great',
    'excellent',
    'amazing',
    'best',
    'love',
    'awesome',
    'fantastic',
    'wonderful',
    'perfect',
    'brilliant',
    'outstanding',
    'superb',
    'good',
    'helpful',
    'easy',
    'fast',
    'quick',
    'efficient',
    'reliable',
    'secure',
  ]
  const negativeWords = [
    'bad',
    'worst',
    'terrible',
    'awful',
    'horrible',
    'poor',
    'slow',
    'broken',
    'buggy',
    'frustrating',
    'annoying',
    'difficult',
    'complicated',
    'confusing',
    'expensive',
    'overpriced',
    'unreliable',
    'insecure',
    'useless',
  ]

  const lowerText = text.toLowerCase()
  let positiveCount = 0
  let negativeCount = 0

  for (const word of positiveWords) {
    if (lowerText.includes(word)) positiveCount++
  }
  for (const word of negativeWords) {
    if (lowerText.includes(word)) negativeCount++
  }

  const total = positiveCount + negativeCount
  if (total === 0) {
    return { label: 'neutral', score: 0, confidence: 0.5 }
  }

  const score = (positiveCount - negativeCount) / total
  const confidence = Math.min(0.9, 0.5 + total * 0.1)

  let label: 'positive' | 'negative' | 'neutral'
  if (score > 0.2) label = 'positive'
  else if (score < -0.2) label = 'negative'
  else label = 'neutral'

  return { label, score, confidence }
}
