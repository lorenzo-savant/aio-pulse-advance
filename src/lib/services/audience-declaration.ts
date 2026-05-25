// PATH: src/lib/services/audience-declaration.ts
//
// "Audience declaration" audit — fetches the brand's homepage and
// (optionally) sitemap.xml, then looks for the signals AI agents key
// off in the delegate economy (Semrush "agentic web" piece):
//   - Vertical/industry pages (/industries/, /solutions/, /for-…)
//   - Persona/role pages (/for-marketers, /for-engineering-leaders)
//   - Use-case pages (/use-cases/, /workflows/)
//   - Explicit "who is this for" language on the homepage
//
// Pure regex over fetched HTML — no LLM cost. Uses safeFetch so an
// operator can't be tricked into having the server probe internal
// addresses via this surface.

import { safeFetchText } from '@/lib/utils/safe-fetch'
import { logger } from '@/lib/logger'

export interface AudienceFinding {
  pattern: 'industry' | 'persona' | 'use_case' | 'audience_phrase'
  url: string
  label: string
}

export interface AudienceAuditResult {
  homepageUrl: string
  fetched: boolean
  homepageHasAudiencePhrase: boolean
  audiencePhraseExamples: string[]
  verticalPagesCount: number
  personaPagesCount: number
  useCasePagesCount: number
  findings: AudienceFinding[]
  score: number // 0..100
  recommendation: string
  errors: string[]
}

// Marketing copy that explicitly declares who the brand is for. We bias
// toward English/Italian/Swedish to match the brands the project tracks.
const AUDIENCE_PHRASES = [
  /\bbuilt\s+for\s+(?:[a-z][\w-]*\s+){1,3}/i,
  /\bdesigned\s+for\s+(?:[a-z][\w-]*\s+){1,3}/i,
  /\bmade\s+for\s+(?:[a-z][\w-]*\s+){1,3}/i,
  /\b(?:trusted|used)\s+by\s+(?:[a-z][\w-]*\s+){1,5}/i,
  /\bfor\s+(?:marketers|engineers|founders|sales\s+teams|product\s+teams|agencies|enterprises|startups|small\s+businesses|developers)\b/i,
  /\bpensato\s+per\s+(?:[a-z][\w-]*\s+){1,3}/i,
  /\bprogettato\s+per\s+(?:[a-z][\w-]*\s+){1,3}/i,
  /\bskapad\s+för\s+(?:[a-z][\wåäö-]*\s+){1,3}/i,
  /\bbyggt\s+för\s+(?:[a-z][\wåäö-]*\s+){1,3}/i,
]

const VERTICAL_PATH_RE = /\/(industries|industry|solutions|verticals|sectors|settori|branscher)\//i
const PERSONA_PATH_RE = /\/(for-[a-z][a-z0-9-]+|per-[a-z][a-z0-9-]+|för-[a-zåäö][a-zåäö0-9-]+)\//i
const USE_CASE_PATH_RE = /\/(use-cases?|workflows?|playbooks?|casi-d-uso|användningsfall)\//i

function extractLinks(html: string, base: URL): URL[] {
  const links: URL[] = []
  const re = /<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["']/gi
  let m: RegExpExecArray | null
  let safety = 0
  while ((m = re.exec(html)) && safety < 5000) {
    safety++
    const raw = m[1]
    if (!raw) continue
    try {
      const u = new URL(raw, base)
      // Only keep links to the same origin — we audit the brand's own
      // information architecture.
      if (u.host !== base.host) continue
      links.push(u)
    } catch {
      /* ignore malformed href */
    }
  }
  return links
}

function uniqueByPath(links: URL[]): URL[] {
  const seen = new Set<string>()
  const out: URL[] = []
  for (const u of links) {
    const key = u.pathname.toLowerCase().replace(/\/+$/, '') || '/'
    if (seen.has(key)) continue
    seen.add(key)
    out.push(u)
  }
  return out
}

function labelFromUrl(u: URL): string {
  const parts = u.pathname.split('/').filter(Boolean)
  return parts[parts.length - 1]?.replace(/-/g, ' ') ?? u.pathname
}

function scoreFor(
  homepageHasPhrase: boolean,
  vertical: number,
  persona: number,
  useCase: number,
): { score: number; recommendation: string } {
  // Weights chosen so a brand with zero industry pages can still earn
  // mid-range if it ships persona + use-case content. The agentic web
  // piece is clear that BOTH /for-… vertical pages and use-cases carry
  // weight — neither alone is enough.
  let score = 0
  if (homepageHasPhrase) score += 20
  score += Math.min(35, vertical * 7)
  score += Math.min(25, persona * 5)
  score += Math.min(20, useCase * 5)
  score = Math.min(100, Math.round(score))

  let recommendation: string
  if (score >= 75) {
    recommendation = 'Strong audience signal — keep adding new verticals as you sell into them.'
  } else if (score >= 45) {
    recommendation =
      'Moderate signal. Add 2-3 industry-specific or role-specific landing pages; AI agents reward specificity.'
  } else if (score >= 20) {
    recommendation =
      'Weak signal. Pick your top 3 buyer personas/industries and publish a dedicated page for each — declare them on the homepage too.'
  } else {
    recommendation =
      'No audience declaration. Agents can\'t match you to a specific user need. Start with a single "Built for [your top vertical]" homepage block, then expand.'
  }
  return { score, recommendation }
}

function ensureHttp(domain: string): string {
  let d = domain.trim()
  if (!/^https?:\/\//i.test(d)) d = `https://${d}`
  return d.replace(/\/+$/, '')
}

export async function runAudienceAudit(domain: string): Promise<AudienceAuditResult> {
  const homepageUrl = ensureHttp(domain)
  const errors: string[] = []
  const findings: AudienceFinding[] = []

  let html = ''
  try {
    const r = await safeFetchText(homepageUrl, {
      timeout: 8000,
      maxBytes: 1_500_000,
    })
    html = r.text
  } catch (e) {
    errors.push(`Failed to fetch homepage: ${e instanceof Error ? e.message : String(e)}`)
    logger.warn('audience-audit: homepage fetch failed', { domain, err: String(e) })
    const result = scoreFor(false, 0, 0, 0)
    return {
      homepageUrl,
      fetched: false,
      homepageHasAudiencePhrase: false,
      audiencePhraseExamples: [],
      verticalPagesCount: 0,
      personaPagesCount: 0,
      useCasePagesCount: 0,
      findings,
      score: result.score,
      recommendation: result.recommendation,
      errors,
    }
  }

  const phraseHits: string[] = []
  // Strip HTML tags + scripts so the audience-phrase regexes don't trip
  // on attribute soup. Cheap, lossy, sufficient for marketing copy.
  const visible = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
  for (const re of AUDIENCE_PHRASES) {
    const m = visible.match(re)
    if (m && phraseHits.length < 5) phraseHits.push(m[0].trim())
  }

  let base: URL
  try {
    base = new URL(homepageUrl)
  } catch {
    errors.push('Invalid homepage URL')
    const result = scoreFor(phraseHits.length > 0, 0, 0, 0)
    return {
      homepageUrl,
      fetched: true,
      homepageHasAudiencePhrase: phraseHits.length > 0,
      audiencePhraseExamples: phraseHits,
      verticalPagesCount: 0,
      personaPagesCount: 0,
      useCasePagesCount: 0,
      findings,
      score: result.score,
      recommendation: result.recommendation,
      errors,
    }
  }

  const links = uniqueByPath(extractLinks(html, base))
  let vertical = 0
  let persona = 0
  let useCase = 0
  for (const u of links) {
    if (VERTICAL_PATH_RE.test(u.pathname)) {
      vertical++
      if (findings.length < 30)
        findings.push({ pattern: 'industry', url: u.toString(), label: labelFromUrl(u) })
    } else if (PERSONA_PATH_RE.test(u.pathname)) {
      persona++
      if (findings.length < 30)
        findings.push({ pattern: 'persona', url: u.toString(), label: labelFromUrl(u) })
    } else if (USE_CASE_PATH_RE.test(u.pathname)) {
      useCase++
      if (findings.length < 30)
        findings.push({ pattern: 'use_case', url: u.toString(), label: labelFromUrl(u) })
    }
  }
  for (const ex of phraseHits) {
    if (findings.length < 30)
      findings.push({ pattern: 'audience_phrase', url: homepageUrl, label: ex })
  }

  const { score, recommendation } = scoreFor(phraseHits.length > 0, vertical, persona, useCase)
  return {
    homepageUrl,
    fetched: true,
    homepageHasAudiencePhrase: phraseHits.length > 0,
    audiencePhraseExamples: phraseHits,
    verticalPagesCount: vertical,
    personaPagesCount: persona,
    useCasePagesCount: useCase,
    findings,
    score,
    recommendation,
    errors,
  }
}
