// Citation source-category classifier. AI engines weight different
// kinds of third-party sources very differently — ChatGPT favours
// Wikipedia + Reddit, Perplexity favours Reddit + LinkedIn + G2,
// Google AI favours Facebook + Yelp. Knowing which CATEGORY of source
// each engine cites for your brand lets the operator pick where to
// invest cross-platform presence.
//
// Pure util. Categorises a hostname (or full URL) into one of seven
// buckets — passing the brand's own domain list flips review/community
// sites into the "first_party" bucket when they're owned subdomains.

export type SourceCategory =
  | 'first_party'
  | 'review_site'
  | 'community'
  | 'encyclopedia'
  | 'editorial'
  | 'social'
  | 'aggregator'
  | 'other'

export interface CategoryStat {
  category: SourceCategory
  count: number
  share: number // 0..1 of total non-empty citations
  topHosts: Array<{ host: string; count: number }>
}

// Hostname → category lookups. Order matters: an entry hits when the
// hostname *ends with* the key (so "uk.trustpilot.com" still maps to
// trustpilot.com). Keep entries lowercased; matchHost normalises input.
//
// Sources mined from the Semrush "Why AI is citing third-party sources"
// piece + the Search Engine Land cross-platform research it cites.
const HOST_CATEGORY: Array<[string, SourceCategory]> = [
  // Review aggregators / B2B comparison
  ['g2.com', 'review_site'],
  ['capterra.com', 'review_site'],
  ['trustpilot.com', 'review_site'],
  ['gartner.com', 'review_site'],
  ['softwareadvice.com', 'review_site'],
  ['getapp.com', 'review_site'],
  ['producthunt.com', 'review_site'],
  ['glassdoor.com', 'review_site'],
  ['indeed.com', 'review_site'],
  ['yelp.com', 'aggregator'],
  ['tripadvisor.com', 'aggregator'],
  ['booking.com', 'aggregator'],
  ['google.com/maps', 'aggregator'],

  // Communities & user-generated content
  ['reddit.com', 'community'],
  ['quora.com', 'community'],
  ['stackexchange.com', 'community'],
  ['stackoverflow.com', 'community'],
  ['ycombinator.com', 'community'],
  ['hackernews.com', 'community'],
  ['medium.com', 'community'],
  ['dev.to', 'community'],
  ['indiehackers.com', 'community'],
  ['discord.com', 'community'],

  // Encyclopedias / reference
  ['wikipedia.org', 'encyclopedia'],
  ['wiktionary.org', 'encyclopedia'],
  ['britannica.com', 'encyclopedia'],
  ['wikidata.org', 'encyclopedia'],
  ['wikihow.com', 'encyclopedia'],

  // Editorial / news / industry publications
  ['forbes.com', 'editorial'],
  ['techcrunch.com', 'editorial'],
  ['theverge.com', 'editorial'],
  ['wired.com', 'editorial'],
  ['cnbc.com', 'editorial'],
  ['nytimes.com', 'editorial'],
  ['wsj.com', 'editorial'],
  ['businessinsider.com', 'editorial'],
  ['bloomberg.com', 'editorial'],
  ['reuters.com', 'editorial'],
  ['fastcompany.com', 'editorial'],
  ['inc.com', 'editorial'],
  ['entrepreneur.com', 'editorial'],
  ['venturebeat.com', 'editorial'],
  ['searchengineland.com', 'editorial'],
  ['searchenginejournal.com', 'editorial'],
  ['semrush.com', 'editorial'],
  ['hubspot.com', 'editorial'],
  ['ahrefs.com', 'editorial'],
  ['moz.com', 'editorial'],

  // Social platforms
  ['linkedin.com', 'social'],
  ['twitter.com', 'social'],
  ['x.com', 'social'],
  ['facebook.com', 'social'],
  ['youtube.com', 'social'],
  ['instagram.com', 'social'],
  ['tiktok.com', 'social'],
  ['pinterest.com', 'social'],
  ['threads.net', 'social'],
  ['bsky.app', 'social'],
  ['mastodon.social', 'social'],
]

function normaliseHost(input: string): string {
  if (!input) return ''
  let s = input.trim().toLowerCase()
  // If a full URL is passed, extract host. Tolerate bare hosts too.
  try {
    if (/^https?:\/\//i.test(s)) {
      s = new URL(s).hostname
    } else if (s.startsWith('//')) {
      s = new URL(`https:${s}`).hostname
    } else if (s.includes('/')) {
      s = new URL(`https://${s}`).hostname
    }
  } catch {
    // Fall through with whatever the caller gave us.
  }
  return s.replace(/^www\./, '')
}

function brandDomainsOf(input: string[] | null | undefined): string[] {
  return (input ?? [])
    .filter((d): d is string => typeof d === 'string' && d.length > 0)
    .map((d) => normaliseHost(d))
}

export function classifyCitationHost(
  urlOrHost: string,
  brandDomains: string[] = [],
): { category: SourceCategory; host: string } {
  const host = normaliseHost(urlOrHost)
  if (!host) return { category: 'other', host: '' }

  const owned = brandDomainsOf(brandDomains)
  if (owned.some((d) => host === d || host.endsWith(`.${d}`))) {
    return { category: 'first_party', host }
  }
  for (const [needle, cat] of HOST_CATEGORY) {
    if (host === needle || host.endsWith(`.${needle}`)) {
      return { category: cat, host }
    }
  }
  return { category: 'other', host }
}

export interface CitationSourceBreakdown {
  total: number
  byCategory: CategoryStat[]
  // For each engine, the dominant category and its share — quick way
  // to see which category each engine likes for this brand.
  perEngine: Array<{
    engine: string
    total: number
    dominant: SourceCategory
    dominantShare: number
    categories: Record<SourceCategory, number>
  }>
}

export interface CitationRow {
  engine: string
  citedUrls: string[]
}

const ALL_CATEGORIES: SourceCategory[] = [
  'first_party',
  'review_site',
  'community',
  'encyclopedia',
  'editorial',
  'social',
  'aggregator',
  'other',
]

function emptyEngineCounts(): Record<SourceCategory, number> {
  const r = {} as Record<SourceCategory, number>
  for (const c of ALL_CATEGORIES) r[c] = 0
  return r
}

export function buildCitationSourceBreakdown(
  rows: CitationRow[],
  brandDomains: string[] = [],
): CitationSourceBreakdown {
  const byCatCount = new Map<SourceCategory, number>()
  const byCatHosts = new Map<SourceCategory, Map<string, number>>()
  const perEngineMap = new Map<string, Record<SourceCategory, number>>()
  let total = 0

  for (const r of rows) {
    if (!r.citedUrls || r.citedUrls.length === 0) continue
    let engineCounts = perEngineMap.get(r.engine)
    if (!engineCounts) {
      engineCounts = emptyEngineCounts()
      perEngineMap.set(r.engine, engineCounts)
    }
    for (const u of r.citedUrls) {
      const { category, host } = classifyCitationHost(u, brandDomains)
      if (!host) continue
      total++
      byCatCount.set(category, (byCatCount.get(category) ?? 0) + 1)
      let hostMap = byCatHosts.get(category)
      if (!hostMap) {
        hostMap = new Map()
        byCatHosts.set(category, hostMap)
      }
      hostMap.set(host, (hostMap.get(host) ?? 0) + 1)
      engineCounts[category]++
    }
  }

  const byCategory: CategoryStat[] = ALL_CATEGORIES.map((cat) => {
    const count = byCatCount.get(cat) ?? 0
    const hostMap = byCatHosts.get(cat) ?? new Map<string, number>()
    const topHosts = Array.from(hostMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([host, count]) => ({ host, count }))
    return {
      category: cat,
      count,
      share: total > 0 ? count / total : 0,
      topHosts,
    }
  }).sort((a, b) => b.count - a.count)

  const perEngine = Array.from(perEngineMap.entries())
    .map(([engine, categories]) => {
      const totalForEngine = ALL_CATEGORIES.reduce((s, c) => s + categories[c], 0)
      let dominant: SourceCategory = 'other'
      let dominantCount = 0
      for (const c of ALL_CATEGORIES) {
        if (categories[c] > dominantCount) {
          dominantCount = categories[c]
          dominant = c
        }
      }
      return {
        engine,
        total: totalForEngine,
        dominant,
        dominantShare: totalForEngine > 0 ? dominantCount / totalForEngine : 0,
        categories,
      }
    })
    .sort((a, b) => b.total - a.total)

  return { total, byCategory, perEngine }
}
