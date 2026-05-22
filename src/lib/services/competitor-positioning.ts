// PATH: src/lib/services/competitor-positioning.ts
//
// "Claims vs. documented reality" competitive dimension (inspired by the
// Competitive-Intelligence-CLI). Our Competitor view measures AI-mention share;
// this adds qualitative positioning analysis: what a rival CLAIMS on its
// marketing pages vs. what its docs/pricing actually deliver — features
// advertised as available but documented as beta/coming-soon, rate limits
// hidden in technical pages, deprecated-but-still-promoted features.
//
// Uses ONLY safeFetch (SSRF-hardened) + the existing resilient LLM chain
// (callLLM) — no new API key, no new dependency.

import { safeFetchText } from '@/lib/utils/safe-fetch'
import { callLLM } from './prompt-generator-ai'
import { logger } from '@/lib/logger'

export type PositioningDimension =
  | 'claim_vs_docs'
  | 'beta_vs_ga'
  | 'hidden_limits'
  | 'deprecated_advertised'
  | 'positioning'

export interface PositioningPage {
  kind: string
  url: string
  ok: boolean
  excerpt: string
}

export interface PositioningFinding {
  dimension: PositioningDimension
  claim: string
  reality: string
  severity: 'low' | 'medium' | 'high'
}

export interface CompetitorPositioning {
  competitor: string
  pagesAnalyzed: PositioningPage[]
  findings: PositioningFinding[]
  summary: string
}

const EXCERPT_LIMIT = 4000

/** Pure: the high-signal pages to inspect, derived from a bare domain or URL. */
export function derivePositioningUrls(domainOrUrl: string): Array<{ kind: string; url: string }> {
  let origin: string
  try {
    const u = new URL(domainOrUrl.includes('://') ? domainOrUrl : `https://${domainOrUrl}`)
    origin = u.origin
  } catch {
    return []
  }
  return [
    { kind: 'homepage', url: `${origin}/` },
    { kind: 'pricing', url: `${origin}/pricing` },
    { kind: 'docs', url: `${origin}/docs` },
    { kind: 'changelog', url: `${origin}/changelog` },
  ]
}

/** Pure: strip HTML to readable text (drops scripts/styles/tags, collapses ws). */
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Pure: best-effort extraction of the first JSON object from an LLM reply. */
export function extractJsonObject(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const body = fenced?.[1] ?? text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  return start >= 0 && end > start ? body.slice(start, end + 1) : '{}'
}

/** Pure: build the claims-vs-reality analysis prompt from fetched page excerpts. */
export function buildPositioningPrompt(
  competitorName: string,
  pages: PositioningPage[],
): { system: string; user: string } {
  const system =
    'You are a competitive-intelligence analyst. Compare what a competitor CLAIMS in marketing copy against what its own documentation and pricing actually deliver. Flag concrete contradictions: marketing claims unsupported by the docs, features advertised as available but documented as beta/coming-soon, rate limits or restrictions hidden in technical pages, and deprecated features still promoted. Cite the specific contradiction. Respond ONLY with JSON, no markdown.'

  const corpus = pages
    .filter((p) => p.ok && p.excerpt)
    .map((p) => `### ${p.kind} (${p.url})\n${p.excerpt}`)
    .join('\n\n')

  const user = `Competitor: ${competitorName}

SOURCE PAGES:
${corpus || '(no pages could be fetched)'}

Return JSON exactly in this shape:
{
  "findings": [
    {
      "dimension": "claim_vs_docs" | "beta_vs_ga" | "hidden_limits" | "deprecated_advertised" | "positioning",
      "claim": "<the marketing claim>",
      "reality": "<what the docs/pricing actually show>",
      "severity": "low" | "medium" | "high"
    }
  ],
  "summary": "<2-3 sentence positioning read>"
}`

  return { system, user }
}

/**
 * Fetch a competitor's marketing + technical pages and analyze claims vs.
 * documented reality. Network/LLM failures degrade gracefully to an empty
 * finding set so the caller (Competitor view / Advisor) never breaks.
 */
export async function analyzeCompetitorPositioning(
  domainOrUrl: string,
  competitorName?: string,
): Promise<CompetitorPositioning> {
  const name = competitorName || domainOrUrl
  const targets = derivePositioningUrls(domainOrUrl)
  const pages: PositioningPage[] = []

  for (const t of targets) {
    try {
      const { text } = await safeFetchText(t.url, { maxBytes: 1_000_000 })
      pages.push({
        kind: t.kind,
        url: t.url,
        ok: true,
        excerpt: stripHtmlToText(text).slice(0, EXCERPT_LIMIT),
      })
    } catch (e) {
      pages.push({ kind: t.kind, url: t.url, ok: false, excerpt: '' })
      logger.warn('competitor-positioning: fetch failed', { url: t.url, err: String(e) })
    }
  }

  let findings: PositioningFinding[] = []
  let summary = ''
  if (pages.some((p) => p.ok && p.excerpt)) {
    const { system, user } = buildPositioningPrompt(name, pages)
    try {
      const { text } = await callLLM(system, user)
      const parsed = JSON.parse(extractJsonObject(text)) as {
        findings?: PositioningFinding[]
        summary?: string
      }
      findings = Array.isArray(parsed.findings) ? parsed.findings : []
      summary = typeof parsed.summary === 'string' ? parsed.summary : ''
    } catch (e) {
      logger.warn('competitor-positioning: analysis failed', { err: String(e) })
    }
  }

  return { competitor: name, pagesAnalyzed: pages, findings, summary }
}
