// PATH: src/lib/utils/sidebar-dominance.ts
//
// Buckets cited domains into 4 groups (UGC / Authority / Owned / Other)
// and surfaces who dominates the AI "sidebar" for the brand's space.
//
// Closes the gap from the Semrush "AI Mode" study (Nov 2025):
//   "92% of AI Mode responses featured a sidebar showing ~7 unique
//    domains. Reddit dominated across AI Mode, AI Overviews, ChatGPT,
//    and Perplexity. In AI Mode, Reddit, YouTube, and Facebook appeared
//    in 68%+ of results with additional links — outpacing traditional
//    brand websites."
//
// What this answers:
//   - Of the domains AI engines cite alongside my brand topic, what
//     fraction are UGC (Reddit/YouTube/Quora), authoritative
//     (Wikipedia, .edu, .gov, major media), brand-owned, or other?
//   - Am I in the "UGC sidebar club" — i.e. does AI cite me at all
//     vs. citing only Reddit + Wikipedia for my space?
//   - What % of prompts include at least one UGC source vs an
//     authority source vs my own domain?
//
// Pure, no network, no dependency. Same posture as
// citation-classifier.ts / citation-depth.ts / engine-format-affinity.ts.

export type SidebarBucket = 'ugc' | 'authority' | 'owned' | 'other'

// User-generated content hosts. Recognised AS UGC even though some host
// owned content (YouTube channels), because the AI's sidebar treatment
// of these domains is community-discussion-first.
const UGC_HOSTS = new Set<string>([
  'reddit.com',
  'quora.com',
  'stackoverflow.com',
  'stackexchange.com',
  'youtube.com',
  'youtu.be',
  'tiktok.com',
  'instagram.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'medium.com',
  'substack.com',
  'producthunt.com',
  'discord.com',
  'github.com', // discussion + UGC-leaning for product/topic queries
])

// Authoritative / encyclopedic / institutional. .edu / .gov / .ac.* are
// matched by suffix below; the explicit hosts cover Wikipedia + major
// outlets that consistently show up in AI sidebars.
const AUTHORITY_HOSTS = new Set<string>([
  'wikipedia.org',
  'wikimedia.org',
  'nytimes.com',
  'bbc.com',
  'bbc.co.uk',
  'reuters.com',
  'apnews.com',
  'theguardian.com',
  'forbes.com',
  'bloomberg.com',
  'wsj.com',
  'washingtonpost.com',
  'cnn.com',
  'cnbc.com',
  'mayoclinic.org',
  'who.int',
  'cdc.gov',
])

const AUTHORITY_TLD_SUFFIXES = ['.edu', '.gov', '.ac.uk', '.ac.jp', '.gob.es', '.gov.uk']

function hostOf(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`)
    return u.hostname.toLowerCase().replace(/^www\./, '') || null
  } catch {
    return null
  }
}

function matchesHostSet(host: string, set: Set<string>): boolean {
  for (const h of set) {
    if (host === h || host.endsWith(`.${h}`)) return true
  }
  return false
}

function hasAuthorityTld(host: string): boolean {
  for (const tld of AUTHORITY_TLD_SUFFIXES) {
    if (host.endsWith(tld)) return true
  }
  return false
}

/**
 * Classify a single URL into one of the four sidebar buckets.
 * Returns 'other' for empty / un-parseable input.
 */
export function classifySidebarBucket(rawUrl: string, ownedHost?: string | null): SidebarBucket {
  const host = hostOf(rawUrl)
  if (!host) return 'other'
  const owned = (ownedHost || '')
    .toLowerCase()
    .replace(/^www\./, '')
    .trim()
  if (owned && (host === owned || host.endsWith(`.${owned}`))) return 'owned'
  if (matchesHostSet(host, UGC_HOSTS)) return 'ugc'
  if (matchesHostSet(host, AUTHORITY_HOSTS) || hasAuthorityTld(host)) return 'authority'
  return 'other'
}

export interface SidebarRowInput {
  /** Distinct response — one row per (prompt × engine × response). */
  id: string
  cited_urls: string[] | null
}

export interface BucketBreakdown {
  ugc: number
  authority: number
  owned: number
  other: number
}

export interface SidebarDominanceReport {
  /** Total cited URLs analysed. */
  totalCitations: number
  /** Total responses with at least one citation. */
  totalResponses: number
  /** Citations per bucket. */
  citations: BucketBreakdown
  /** Citation share % per bucket (1 decimal). */
  citationShare: BucketBreakdown
  /** Responses containing AT LEAST ONE citation from each bucket. */
  responseCoverage: BucketBreakdown
  /** Response coverage as % of totalResponses (1 decimal). */
  responseCoverageShare: BucketBreakdown
  /** Single sortable "sidebar score" 0-100 — higher = brand more
   *  represented in the AI sidebar. Computed as the share of responses
   *  in which the brand was cited at least once. */
  sidebarScore: number
}

function emptyBreakdown(): BucketBreakdown {
  return { ugc: 0, authority: 0, owned: 0, other: 0 }
}

function asShare(counts: BucketBreakdown, total: number): BucketBreakdown {
  const out = emptyBreakdown()
  if (total <= 0) return out
  for (const k of ['ugc', 'authority', 'owned', 'other'] as const) {
    out[k] = Math.round((counts[k] / total) * 1000) / 10
  }
  return out
}

/**
 * Build the sidebar-dominance report from a list of monitoring rows.
 *
 * @param rows monitoring rows — each row's cited_urls[] is one response.
 * @param ownedHost the brand's own domain (host or full URL), so we can
 *                  distinguish "owned" from "other".
 */
export function computeSidebarDominance(
  rows: SidebarRowInput[],
  ownedHost?: string | null,
): SidebarDominanceReport {
  const citations = emptyBreakdown()
  const responseCoverage = emptyBreakdown()
  let totalCitations = 0
  let totalResponses = 0
  let responsesWithOwned = 0

  for (const row of rows) {
    const urls = Array.isArray(row.cited_urls) ? row.cited_urls : []
    if (urls.length === 0) continue
    totalResponses++
    const seenBuckets = { ugc: false, authority: false, owned: false, other: false }
    for (const u of urls) {
      const b = classifySidebarBucket(u, ownedHost)
      citations[b]++
      totalCitations++
      seenBuckets[b] = true
    }
    if (seenBuckets.ugc) responseCoverage.ugc++
    if (seenBuckets.authority) responseCoverage.authority++
    if (seenBuckets.owned) {
      responseCoverage.owned++
      responsesWithOwned++
    }
    if (seenBuckets.other) responseCoverage.other++
  }

  const citationShare = asShare(citations, totalCitations)
  const responseCoverageShare = asShare(responseCoverage, totalResponses)
  const sidebarScore =
    totalResponses > 0 ? Math.round((responsesWithOwned / totalResponses) * 1000) / 10 : 0

  return {
    totalCitations,
    totalResponses,
    citations,
    citationShare,
    responseCoverage,
    responseCoverageShare,
    sidebarScore,
  }
}
