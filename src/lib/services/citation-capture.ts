// PATH: src/lib/services/citation-capture.ts
//
// "Citation Capture Rate" — operationalises the cheap-win from industry research
// SERP-feature article: for every prompt where the AI engine MENTIONED
// the brand by name, was the BRAND'S OWN domain among the cited URLs?
// If the AI mentions you but cites Wikipedia / a competitor / a blog
// instead, the brand has a content-format problem — the AI knows about
// you but doesn't consider your site the authoritative source on the
// topic. Direct port of the "Domain doesn't rank in feature" filter.
//
// Pure + deterministic. Caller passes raw monitoring_results rows + the
// brand's own domain (+ optional alias domains); we tally per-engine and
// surface a "gap list" of prompts that mentioned the brand without
// citing its site.

export interface CaptureInputRow {
  /** monitoring_results.id — used in the gap-list output. */
  id: string
  /** Engine that produced the row (chatgpt | gemini | perplexity | claude | …). */
  engine: string | null
  /** Verbatim user query the AI engine answered. */
  prompt_text: string | null
  /** Full URLs the AI cited as sources. May be null/empty. */
  cited_urls: string[] | null
  /** True when the response contained the brand name. */
  brand_mentioned: boolean | null
  /** Set true by the homonym-audit when the mention is actually about a
   *  same-named entity. We exclude those rows by default — they're noise
   *  for capture-rate purposes. */
  confusion_flag?: boolean | null
  created_at: string | null
}

export interface CaptureGapRow {
  id: string
  engine: string | null
  prompt_text: string | null
  /** Sample of up to 3 hosts the AI cited INSTEAD of the brand. Lets the
   *  operator see which competitors / authorities are claiming the
   *  citation slot they're missing. */
  citedInstead: string[]
  citedCount: number
  created_at: string | null
}

export interface CaptureByEngine {
  engine: string
  mentions: number
  capturedMentions: number
  captureRate: number
}

export interface CaptureReport {
  /** Total rows audited (brand_mentioned=true, not confusion-flagged). */
  totalMentions: number
  /** Mentions where the brand's own domain appears in cited_urls. */
  capturedMentions: number
  /** capturedMentions / totalMentions × 100, 0 when no mentions. */
  captureRate: number
  /** Per-engine breakdown ordered by mention volume desc. */
  byEngine: CaptureByEngine[]
  /** Top N (default 20) most-recent mention-without-citation rows. */
  gapList: CaptureGapRow[]
  /** Mention counter that had zero cited URLs at all (vs. "cited just
   *  not your domain"). Useful diagnostic — "zero citations" usually
   *  means the AI was generating from memory rather than retrieval. */
  mentionsWithoutAnyCitation: number
}

/** Lowercase registrable host, no protocol / www / path. Mirrors the
 *  pattern used by citation-sources/route.ts — keeps the two services
 *  consistent on what counts as the brand's own domain. */
export function hostOf(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null
  try {
    const u = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`)
    return u.hostname.toLowerCase().replace(/^www\./, '') || null
  } catch {
    return null
  }
}

/** Build the set of "own domains" — primary + the brand.domains[] column
 *  (additional owned domains) + apex form of each. We don't try to
 *  resolve subdomains; matching is exact-or-suffix (`*.acasting.se`). */
export function buildOwnedDomainSet(
  primary: string | null,
  extra: string[] | null | undefined,
): Set<string> {
  const out = new Set<string>()
  const p = hostOf(primary)
  if (p) out.add(p)
  for (const d of extra ?? []) {
    const h = hostOf(d)
    if (h) out.add(h)
  }
  return out
}

function isOwnedHost(host: string, owned: Set<string>): boolean {
  if (owned.has(host)) return true
  for (const o of owned) {
    if (host === o || host.endsWith(`.${o}`)) return true
  }
  return false
}

export interface ComputeOptions {
  /** Max gap rows to keep in the response. Default 20. */
  gapLimit?: number
}

/**
 * Pure computation entry point. Takes a list of monitoring_results rows
 * filtered to a single brand + a time window and returns the capture
 * report. Skips confusion-flagged rows (homonym audit decided they
 * weren't actually about this brand).
 */
export function computeCitationCapture(
  rows: CaptureInputRow[],
  ownedDomains: Set<string>,
  opts: ComputeOptions = {},
): CaptureReport {
  const gapLimit = opts.gapLimit ?? 20

  const perEngine = new Map<string, { mentions: number; captured: number }>()
  let totalMentions = 0
  let capturedMentions = 0
  let mentionsWithoutAnyCitation = 0
  const gapCandidates: CaptureGapRow[] = []

  for (const r of rows) {
    if (!r.brand_mentioned) continue
    if (r.confusion_flag === true) continue

    totalMentions++
    const engine = r.engine ?? 'unknown'
    const bucket = perEngine.get(engine) ?? { mentions: 0, captured: 0 }
    bucket.mentions++

    const citedHosts = (r.cited_urls ?? []).map(hostOf).filter((h): h is string => Boolean(h))

    const ownedCited = citedHosts.some((h) => isOwnedHost(h, ownedDomains))

    if (ownedCited) {
      capturedMentions++
      bucket.captured++
    } else {
      // Capture gap — collect for the gap list.
      if (citedHosts.length === 0) mentionsWithoutAnyCitation++
      gapCandidates.push({
        id: r.id,
        engine: r.engine,
        prompt_text: r.prompt_text,
        // De-duplicate hosts and cap at 3 — enough for "who's stealing
        // your citation slot" intent without bloating the response.
        citedInstead: Array.from(new Set(citedHosts)).slice(0, 3),
        citedCount: citedHosts.length,
        created_at: r.created_at,
      })
    }
    perEngine.set(engine, bucket)
  }

  const captureRate =
    totalMentions > 0 ? Math.round((capturedMentions / totalMentions) * 1000) / 10 : 0

  const byEngine: CaptureByEngine[] = Array.from(perEngine.entries())
    .map(([engine, v]) => ({
      engine,
      mentions: v.mentions,
      capturedMentions: v.captured,
      captureRate: v.mentions > 0 ? Math.round((v.captured / v.mentions) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.mentions - a.mentions)

  // Gap list: most-recent first, capped.
  const gapList = gapCandidates
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, gapLimit)

  return {
    totalMentions,
    capturedMentions,
    captureRate,
    byEngine,
    gapList,
    mentionsWithoutAnyCitation,
  }
}
