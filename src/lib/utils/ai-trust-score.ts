// PATH: src/lib/utils/ai-trust-score.ts
//
// AEO Pulse — AI Trust Score: a proprietary 0–100 metric estimating how
// "trustworthy" a cited domain is from the perspective of AI engines, built
// from FREE signals we already collect. Inspired by Majestic's Trust Flow
// concept (referenced in the IT SEO methodology doc) but built without
// integrating any paid backlink database.
//
// Signals (additive, all derived from monitoring_results we already have):
//
//   1. cross-engine frequency  → 40 pts max
//      A domain cited by all 4 engines (ChatGPT/Gemini/Perplexity/Claude)
//      is universally trusted. One engine = 10 pts, two = 20, three = 30,
//      four = 40.
//
//   2. domain category         → 30 pts max
//      Institutional (.gov/.edu) > wiki > official press > community
//      (Reddit/SO/Quora — high AI-citation surfaces) > aggregator/social
//      > commercial > unknown.
//
//   3. volume share            → 20 pts max
//      Log-scaled share of all citations in the window. Top-cited
//      authoritative domain gets close to 20; long-tail one-offs get
//      near 0.
//
//   4. sentiment alignment     → 10 pts max
//      When we know the avg sentiment of responses that cited this domain,
//      lean toward non-negative sources (negative-portrayal sources don't
//      earn "trust" credit from the brand's POV).
//
// All four signals are optional inputs — passing null/undefined just zeros
// that component and the rest still works. Pure, no I/O.

export type DomainCategory =
  | 'institutional'
  | 'wiki'
  | 'official_press'
  | 'community'
  | 'social'
  | 'aggregator'
  | 'commercial'
  | 'unknown'

/** TLD suffixes that signal an institutional source. */
const INSTITUTIONAL_SUFFIXES = [
  '.gov',
  '.mil',
  '.edu',
  '.gov.uk',
  '.ac.uk',
  '.gov.au',
  '.edu.au',
  '.gouv.fr',
  '.gov.it',
  '.edu.it',
  '.gob.es',
  '.gob.mx',
  '.gov.se',
  '.europa.eu',
]

const WIKI_HOSTS = ['wikipedia.org', 'wikidata.org', 'wikimedia.org', 'wiktionary.org']

const OFFICIAL_PRESS = [
  'nytimes.com',
  'reuters.com',
  'apnews.com',
  'bbc.com',
  'bbc.co.uk',
  'theguardian.com',
  'wsj.com',
  'ft.com',
  'bloomberg.com',
  'economist.com',
  'cnn.com',
  'cnbc.com',
  'nbcnews.com',
  'washingtonpost.com',
  'forbes.com',
  'businessinsider.com',
  'time.com',
  'techcrunch.com',
  'theverge.com',
  'arstechnica.com',
  'wired.com',
  'corriere.it',
  'repubblica.it',
  'lastampa.it',
  'ilsole24ore.com',
  'svd.se',
  'dn.se',
]

const COMMUNITY = [
  'reddit.com',
  'stackoverflow.com',
  'stackexchange.com',
  'quora.com',
  'github.com',
  'medium.com', // expert-author platform
  'dev.to',
  'hackernoon.com',
  'producthunt.com',
]

const SOCIAL = [
  'twitter.com',
  'x.com',
  'facebook.com',
  'linkedin.com',
  'instagram.com',
  'tiktok.com',
  'pinterest.com',
  'threads.net',
  'mastodon.social',
]

const AGGREGATOR = [
  'g2.com',
  'capterra.com',
  'trustpilot.com',
  'gartner.com',
  'softwareadvice.com',
  'getapp.com',
  'crozdesk.com',
]

function hostMatches(host: string, list: string[]): boolean {
  return list.some((h) => host === h || host.endsWith(`.${h}`))
}

function hostEndsWithSuffix(host: string, suffixes: string[]): boolean {
  return suffixes.some((s) => host.endsWith(s))
}

/** Categorize a domain by its public role (free, deterministic). */
export function classifyDomainAuthority(host: string): DomainCategory {
  if (typeof host !== 'string' || !host.trim()) return 'unknown'
  const h = host.toLowerCase().replace(/^www\./, '')
  if (hostEndsWithSuffix(h, INSTITUTIONAL_SUFFIXES)) return 'institutional'
  if (hostMatches(h, WIKI_HOSTS)) return 'wiki'
  if (hostMatches(h, OFFICIAL_PRESS)) return 'official_press'
  if (hostMatches(h, COMMUNITY)) return 'community'
  if (hostMatches(h, SOCIAL)) return 'social'
  if (hostMatches(h, AGGREGATOR)) return 'aggregator'
  // Heuristic: any other registrable domain is treated as commercial.
  // (We classify spam patterns at the output stage if needed.)
  return 'commercial'
}

const CATEGORY_POINTS: Record<DomainCategory, number> = {
  institutional: 30,
  wiki: 25,
  official_press: 20,
  community: 15,
  social: 10,
  aggregator: 10,
  commercial: 5,
  unknown: 0,
}

export interface TrustScoreInput {
  /** Citations of THIS domain in the window. */
  citationsCount: number
  /** Total citations across all domains in the same window (for share calc). */
  totalCitationsInWindow: number
  /** Distinct engines that cited this domain. */
  engines: readonly string[]
  /**
   * Avg sentiment_score (-1..+1) of the responses that cited this domain.
   * Pass null/undefined when unknown — we'll fall back to a neutral score.
   */
  avgSentiment?: number | null
  /** Pre-classified category; passed in to avoid re-classifying when the
   *  caller already has the host parsed (small perf win). */
  category?: DomainCategory
  /** The host itself, used to derive category when not pre-classified. */
  host: string
}

export interface TrustScoreOutput {
  score: number
  category: DomainCategory
  breakdown: {
    crossEngine: number
    categoryBoost: number
    volumeShare: number
    sentimentAlignment: number
  }
  reasoning: string[]
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function crossEnginePoints(engineCount: number): number {
  // 1 → 10, 2 → 20, 3 → 30, 4+ → 40.
  return clamp(engineCount, 0, 4) * 10
}

function categoryPoints(category: DomainCategory): number {
  return CATEGORY_POINTS[category] ?? 0
}

/** Log-scaled share. Aggressive at the low end so a 1-in-200 long-tail
 *  citation earns very little credit (≈4 pts) while a true heavyweight
 *  (≥20% share) earns close to the max.
 *
 *  Reference points with the calibrated formula (22 + 8·log10(share),
 *  clamped to 0–20):
 *    share=0.005 (1 of 200) → 4
 *    share=0.01            → 6
 *    share=0.05            → 12
 *    share=0.20            → 16
 *    share=0.50            → 20 (capped) */
function volumeSharePoints(citationsCount: number, totalCitationsInWindow: number): number {
  if (totalCitationsInWindow <= 0 || citationsCount <= 0) return 0
  const share = citationsCount / totalCitationsInWindow
  const raw = 22 + 8 * Math.log10(share)
  return clamp(Math.round(raw), 0, 20)
}

function sentimentAlignmentPoints(avg: number | null | undefined): number {
  if (avg == null || !Number.isFinite(avg)) return 5 // neutral fallback
  if (avg >= 0.2) return 10
  if (avg >= 0) return 7
  if (avg >= -0.2) return 5
  return 0 // negative-portrayal sources don't earn trust credit
}

export function computeAiTrustScore(input: TrustScoreInput): TrustScoreOutput {
  const category = input.category ?? classifyDomainAuthority(input.host)
  const engineCount = new Set(input.engines).size
  const breakdown = {
    crossEngine: crossEnginePoints(engineCount),
    categoryBoost: categoryPoints(category),
    volumeShare: volumeSharePoints(input.citationsCount, input.totalCitationsInWindow),
    sentimentAlignment: sentimentAlignmentPoints(input.avgSentiment),
  }
  const score = clamp(
    breakdown.crossEngine +
      breakdown.categoryBoost +
      breakdown.volumeShare +
      breakdown.sentimentAlignment,
    0,
    100,
  )

  const reasoning: string[] = []
  reasoning.push(`Cited by ${engineCount}/4 engines (+${breakdown.crossEngine})`)
  reasoning.push(`Category: ${category} (+${breakdown.categoryBoost})`)
  reasoning.push(`Volume share (+${breakdown.volumeShare})`)
  if (input.avgSentiment != null && Number.isFinite(input.avgSentiment)) {
    reasoning.push(
      `Avg sentiment ${input.avgSentiment.toFixed(2)} (+${breakdown.sentimentAlignment})`,
    )
  } else {
    reasoning.push(`Sentiment unknown (+${breakdown.sentimentAlignment} neutral)`)
  }

  return { score, category, breakdown, reasoning }
}

/** Convenience band for UI colour-coding. */
export function trustBand(score: number): 'high' | 'medium' | 'low' {
  if (score >= 60) return 'high'
  if (score >= 30) return 'medium'
  return 'low'
}
