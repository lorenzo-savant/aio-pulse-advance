// PATH: src/lib/services/citation-grounding.ts
//
// Citation grounding + cleaning — improves the `cited_urls` stored per
// monitoring result, which is what every downstream view aggregates
// (Citations, Citation Sources, GEO Score citationRate).
//
// Two responsibilities:
//   1. cleanCitations() — normalize + de-junk + dedup ANY citation list, from
//      any engine. Pure + synchronous, so it's unit-tested without network.
//   2. groundCitationsViaBrave() — for engines that don't natively cite
//      (ChatGPT, Claude), fetch REAL on-topic sources from Brave: the
//      Summarizer's citations (what an AI Overview actually cited) first, then
//      organic top results. Cached + soft-failing, so it never breaks a run.

import {
  isBraveSearchAvailable,
  summarizeQuery,
  fetchWebResults,
  BraveQuotaExceeded,
} from './brave-search'
import { isValidUrl } from '@/lib/utils'
import { logger } from '@/lib/logger'

// Hosts that are never a real citation source: the search/AI engines
// themselves and Vertex's grounding-redirect host. Matched as the registrable
// domain (host === x OR host endsWith ".x"), so subdomains are covered without
// nuking unrelated domains.
const JUNK_HOSTS = [
  'google.com',
  'bing.com',
  'duckduckgo.com',
  'search.brave.com',
  'vertexaisearch.cloud.google.com',
  'openai.com',
  'chatgpt.com',
  'gemini.google.com',
  'bard.google.com',
  'anthropic.com',
  'claude.ai',
  'perplexity.ai',
]

// Query params that carry no destination meaning — campaign/click tracking.
const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'gad',
  'gad_source',
  'gbraid',
  'wbraid',
  'msclkid',
  'ref',
  'ref_src',
  'ref_url',
  'mc_cid',
  'mc_eid',
  '_hsenc',
  '_hsmi',
  'igshid',
  'spm',
  'vero_id',
  'yclid',
])

function isJunkHost(host: string): boolean {
  return JUNK_HOSTS.some((j) => host === j || host.endsWith(`.${j}`))
}

/**
 * Canonicalize a URL for citation storage/dedup: lowercase host, drop www,
 * strip the fragment and tracking params, and remove a trailing slash. Returns
 * null for invalid or junk-host URLs so callers can filter in one pass.
 */
export function normalizeCitation(rawUrl: string): string | null {
  const trimmed = (rawUrl || '').trim()
  if (!trimmed || !isValidUrl(trimmed)) return null
  let parsed: URL
  try {
    parsed = new URL(trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  if (!host || isJunkHost(host)) return null

  // Strip tracking params (incl. anything utm_*).
  for (const key of [...parsed.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMS.has(key.toLowerCase())) {
      parsed.searchParams.delete(key)
    }
  }

  parsed.hash = ''
  parsed.hostname = host
  parsed.protocol = 'https:'
  let out = parsed.toString()
  // Drop a bare trailing slash (but keep "https://host/" readable as host).
  out = out.replace(/\/$/, '')
  return out
}

export interface CleanCitationOptions {
  /** Max citations to keep after dedup (avoids noise). Default 20. */
  max?: number
}

/**
 * Normalize + de-junk + dedup a citation list from any source. Order is
 * preserved (first occurrence wins), so higher-confidence citations passed
 * first survive the cap.
 */
export function cleanCitations(urls: string[], opts: CleanCitationOptions = {}): string[] {
  const max = opts.max ?? 20
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of urls) {
    const norm = normalizeCitation(raw)
    if (!norm || seen.has(norm)) continue
    seen.add(norm)
    out.push(norm)
    if (out.length >= max) break
  }
  return out
}

export interface GroundedCitations {
  citations: string[]
  provider: 'brave:summarizer' | 'brave:web' | 'none'
}

/**
 * Fetch real, on-topic source URLs for a query from Brave. Prefers the
 * Summarizer's own citations (closest analogue to "what the AI cited"); falls
 * back to organic top results. Always soft-fails to an empty list — grounding
 * is an enhancement, never a hard dependency of a monitoring run.
 */
export async function groundCitationsViaBrave(
  query: string,
  language?: string,
  opts: CleanCitationOptions = {},
): Promise<GroundedCitations> {
  if (!isBraveSearchAvailable() || !query.trim()) {
    return { citations: [], provider: 'none' }
  }

  try {
    const summary = await summarizeQuery(query, language)
    if (summary && summary.citations.length > 0) {
      const citations = cleanCitations(
        summary.citations.map((c) => c.url),
        opts,
      )
      if (citations.length > 0) return { citations, provider: 'brave:summarizer' }
    }
  } catch (err) {
    if (err instanceof BraveQuotaExceeded) {
      logger.warn('Citation grounding: Brave quota exhausted', { service: 'citation-grounding' })
      return { citations: [], provider: 'none' }
    }
    logger.warn('Citation grounding: summarizer failed, trying web results', {
      service: 'citation-grounding',
      err: err instanceof Error ? err.message : String(err),
    })
  }

  try {
    const results = await fetchWebResults(query, language, 10)
    const citations = cleanCitations(
      results.map((r) => r.url),
      opts,
    )
    if (citations.length > 0) return { citations, provider: 'brave:web' }
  } catch (err) {
    if (!(err instanceof BraveQuotaExceeded)) {
      logger.warn('Citation grounding: web results failed', {
        service: 'citation-grounding',
        err: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { citations: [], provider: 'none' }
}
