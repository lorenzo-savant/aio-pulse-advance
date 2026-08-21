// PATH: src/lib/services/source-taxonomy.ts
//
// Source taxonomy — Missing / Shared / Strong / Unique.
//
// The citation-sources ranking answers "which domains do the engines cite".
// This answers the question underneath it: *for whom*. A domain the engines
// reach for whenever they discuss the rivals, and never when they discuss us,
// is an outreach target. A domain only we activate is a position to defend.
// Same rows, one cross-tabulation, and the list turns into a plan.
//
// THE DEFINITIONS ARE ADAPTED, AND THE ADAPTATION MATTERS
// Semrush compares per-brand campaigns: they run the brand's prompts and the
// competitor's prompts separately and intersect the two source lists. We have
// something different and, for this purpose, sharper — co-occurrence inside a
// single answer. When an engine answers one question, either it mentioned the
// brand or it did not, and either it mentioned a declared competitor or it did
// not. So "cited with the competitors" here means "cited in answers where a
// rival was named", not "cited in the rival's own campaign". The classes carry
// the same operational meaning; the measurement underneath them is ours.
//
// WITHOUT A DECLARED COMPETITOR LIST THIS METRIC DOES NOT EXIST
// Every class is defined against competitor co-occurrence. A brand that has
// declared no competitors would see every domain fall into 'unique' — a clean,
// confident, meaningless answer. classifySources refuses instead: it returns
// no classification and says why, and the UI asks for the list.
//
// Pure and deterministic — no DB, no network — like share-of-voice.ts.

import { buildCompetitorMatcher } from './competitor-identity'

export interface SourceTaxonomyRow {
  cited_urls: string[] | null
  brand_mentioned: boolean | null
  /** As stored on monitoring_results: the names the extractor observed. Raw
   *  spellings — matched against the declared list, never trusted as-is. */
  competitor_mentions: Array<{ name: string }> | null
}

export type SourceClass = 'missing' | 'shared' | 'strong' | 'unique'

export interface ClassifiedSource {
  domain: string
  class: SourceClass
  /** Responses that cited this domain AND mentioned the brand. */
  citedWithBrand: number
  /** Responses that cited this domain AND mentioned a declared competitor. */
  citedWithCompetitors: number
  /** Responses that cited this domain at all — counted once per response, so a
   *  page cited three times in one answer is one observation, not three. */
  totalCitations: number
}

export interface SourceTaxonomyReport {
  sources: ClassifiedSource[]
  /** True when the brand has no declared competitors — `sources` is empty and
   *  the caller must say so rather than render an empty state that reads like
   *  "no sources found". */
  requiresDeclaredCompetitors: boolean
  /** The brand's own domain, reported apart from the classification. Seeing
   *  your own site filed under "shared" reads as a finding when it is an
   *  artefact of the arithmetic. */
  ownDomain: { domain: string; totalCitations: number } | null
  /** Domains dropped for appearing fewer than `minCitations` times. Reported so
   *  a short list is legible as a threshold effect, not as an empty market. */
  belowThreshold: number
}

export interface SourceTaxonomyOptions {
  /** Declared competitor list from the brand row. */
  competitors?: readonly string[] | null
  /** The brand's own domain, excluded from the classification. */
  ownDomain?: string | null
  /** Minimum responses a domain must appear in to be classified. One sighting
   *  is a real observation but not yet a pattern; 2 is the default, and callers
   *  that want everything can pass 1. */
  minCitations?: number
  /** Cap on the returned list. */
  limit?: number
}

/** Registrable host, lowercased, no protocol / www / path. Mirrors the
 *  normalisation the citation-sources route already applies so the two
 *  surfaces group the same domains. */
export function hostOf(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`)
    return u.hostname.toLowerCase().replace(/^www\./, '') || null
  } catch {
    return null
  }
}

function isOwnHost(host: string, ownDomain: string | null): boolean {
  if (!ownDomain) return false
  return host === ownDomain || host.endsWith(`.${ownDomain}`)
}

/** Ranking order: the gaps first. A domain the engines use for the rivals and
 *  never for us is the only class that names work to do; a domain we hold
 *  alone is worth knowing but needs nothing today. */
const CLASS_RANK: Record<SourceClass, number> = {
  missing: 0,
  strong: 1,
  unique: 2,
  shared: 3,
}

/**
 * Cross-tabulate cited domains against who the answer was about.
 *
 * For each domain, over the rows where it was cited:
 *   missing — never with the brand, at least once with a competitor
 *   unique  — at least once with the brand, never with a competitor
 *   strong  — both, and the brand side is larger
 *   shared  — both, and the competitor side is at least as large
 */
export function classifySources(
  rows: readonly SourceTaxonomyRow[],
  options: SourceTaxonomyOptions = {},
): SourceTaxonomyReport {
  const {
    competitors = null,
    ownDomain: rawOwnDomain = null,
    minCitations = 2,
    limit = 100,
  } = options

  const ownDomain = rawOwnDomain ? hostOf(rawOwnDomain) : null
  const matcher = buildCompetitorMatcher(competitors ?? null)

  if (!matcher.hasDeclaredList) {
    return {
      sources: [],
      requiresDeclaredCompetitors: true,
      ownDomain: null,
      belowThreshold: 0,
    }
  }

  interface Acc {
    domain: string
    withBrand: number
    withCompetitors: number
    total: number
  }
  const byDomain = new Map<string, Acc>()
  let ownCitations = 0

  for (const row of rows) {
    const urls = Array.isArray(row.cited_urls) ? row.cited_urls : []
    if (urls.length === 0) continue

    const brandMentioned = row.brand_mentioned === true
    // Only DECLARED competitors count. The raw name on the row is whatever the
    // extractor saw, and it is matched at word-level through the shared matcher
    // — the same guard that keeps "Acast" out of "Acasting".
    const competitorMentioned = (row.competitor_mentions ?? []).some(
      (m) => m && typeof m.name === 'string' && matcher.isDeclared(m.name),
    )

    // One response counts once per domain, however many of its pages were cited.
    const seenInRow = new Set<string>()
    for (const rawUrl of urls) {
      const host = hostOf(rawUrl)
      if (!host || seenInRow.has(host)) continue
      seenInRow.add(host)

      if (isOwnHost(host, ownDomain)) {
        ownCitations++
        continue
      }

      let acc = byDomain.get(host)
      if (!acc) {
        acc = { domain: host, withBrand: 0, withCompetitors: 0, total: 0 }
        byDomain.set(host, acc)
      }
      acc.total++
      if (brandMentioned) acc.withBrand++
      if (competitorMentioned) acc.withCompetitors++
    }
  }

  const sources: ClassifiedSource[] = []
  let belowThreshold = 0

  for (const acc of byDomain.values()) {
    if (acc.total < minCitations) {
      belowThreshold++
      continue
    }
    // A domain cited only in answers that named neither side classifies as
    // 'unique' only if the brand was there; with both counters at zero it is
    // background noise about the category, so it stays out of the plan.
    if (acc.withBrand === 0 && acc.withCompetitors === 0) continue

    let cls: SourceClass
    if (acc.withBrand === 0) cls = 'missing'
    else if (acc.withCompetitors === 0) cls = 'unique'
    else if (acc.withBrand > acc.withCompetitors) cls = 'strong'
    else cls = 'shared'

    sources.push({
      domain: acc.domain,
      class: cls,
      citedWithBrand: acc.withBrand,
      citedWithCompetitors: acc.withCompetitors,
      totalCitations: acc.total,
    })
  }

  sources.sort(
    (a, b) =>
      CLASS_RANK[a.class] - CLASS_RANK[b.class] ||
      b.totalCitations - a.totalCitations ||
      a.domain.localeCompare(b.domain),
  )

  return {
    sources: sources.slice(0, limit),
    requiresDeclaredCompetitors: false,
    ownDomain: ownDomain ? { domain: ownDomain, totalCitations: ownCitations } : null,
    belowThreshold,
  }
}
