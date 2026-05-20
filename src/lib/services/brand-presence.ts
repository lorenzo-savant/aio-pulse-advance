// PATH: src/lib/services/brand-presence.ts
//
// Detects whether a brand has presence on two platforms that
// disproportionately influence AI search citations:
//
//   - Wikipedia: ~47.9% of ChatGPT top citations come from Wikipedia
//     (AI Platform Citation Patterns study, 2025). A brand without a
//     Wikipedia article is effectively invisible to ChatGPT for
//     "what is X" / "tell me about X" queries.
//
//   - Reddit: ~46.7% of Perplexity citations are Reddit threads. For
//     consumer-facing brands in industries with active subreddits,
//     having authentic Reddit presence multiplies Perplexity visibility.
//
// Both checks are cheap and free:
//   - Wikipedia: official REST API, no key, no rate-limit headache,
//     instant 200/404 response. We just need to know "does an article
//     exist with this exact title (or domain-derived title)".
//   - Reddit: we don't query Reddit directly (anon API is rate-limited
//     and pagination-quirky). Instead we use Brave's `site:reddit.com`
//     search — if a brand-name query against reddit.com returns ≥3
//     results, we count it as having Reddit presence.
//
// Both surfaces produce structured BrandPresence the Strategy Advisor
// can quote in recommendations.

import { logger } from '@/lib/logger'
import { safeFetch, SsrfError } from '@/lib/utils/safe-fetch'
import { searchBrandRanking, isBraveSearchAvailable } from './brave-search'

export interface PlatformPresence {
  /** Best-effort: did we find a match? */
  found: boolean
  /** URL to the page we found, when found. */
  url: string | null
  /** Title / display name from the platform, when available. */
  title: string | null
  /**
   * For Reddit specifically: how many distinct hits Brave returned for
   * `site:reddit.com <brand>`. Lets the Strategist say "you appear in
   * N Reddit threads" instead of just "yes/no".
   */
  matchCount?: number
  /** Optional notes (e.g. "checked via Wikipedia REST API", error mode). */
  note?: string
}

export interface BrandPresence {
  wikipedia: PlatformPresence
  reddit: PlatformPresence
}

// ─── Wikipedia ─────────────────────────────────────────────────────────────
//
// Wikipedia REST API returns 200 with the article summary or 404 if the
// page doesn't exist. We don't need search — we just check whether an
// article with the brand's name (or alias) exists. Title-case the name
// since Wikipedia titles are case-sensitive.

const WIKI_LANGS_TO_TRY: Array<'en' | 'it' | 'sv'> = ['en', 'it', 'sv']
const WIKI_TIMEOUT_MS = 6000

function wikipediaTitleCandidates(brandName: string, aliases: string[]): string[] {
  const candidates = new Set<string>()
  const normalize = (s: string) =>
    s
      .trim()
      .replace(/\s+/g, ' ')
      // Wikipedia uses underscore in URLs, but the REST API accepts spaces.
      // We pass spaces; the API URL-encodes them.
      .replace(/^./, (c) => c.toUpperCase())
  candidates.add(normalize(brandName))
  for (const a of aliases) {
    if (a && a.length > 1) candidates.add(normalize(a))
  }
  return [...candidates]
}

async function checkOneWikipediaLang(
  language: 'en' | 'it' | 'sv',
  title: string,
): Promise<{ found: true; url: string; canonicalTitle: string } | null> {
  const encoded = encodeURIComponent(title.replace(/ /g, '_'))
  const url = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encoded}`
  try {
    const res = await safeFetch(url, {
      method: 'GET',
      timeout: WIKI_TIMEOUT_MS,
      // Wikipedia's REST API requires a User-Agent (other clients get 403).
      headers: { 'User-Agent': 'AIO-Pulse-BrandPresenceCheck/1.0 (aio-pulse.com)' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      title?: string
      content_urls?: { desktop?: { page?: string } }
      type?: string
    }
    // Wikipedia returns 200 with type === 'disambiguation' for disambig pages
    // — we treat those as "no canonical article" because they're not a single
    // brand entity but a list of meanings. Same for redirects pointing to
    // someone else.
    if (data.type === 'disambiguation') return null
    const canonicalUrl =
      data.content_urls?.desktop?.page || `https://${language}.wikipedia.org/wiki/${encoded}`
    return { found: true, url: canonicalUrl, canonicalTitle: data.title ?? title }
  } catch (err) {
    if (!(err instanceof SsrfError)) {
      logger.warn('brand-presence: wikipedia check failed', {
        service: 'brand-presence',
        language,
        title,
        err: err instanceof Error ? err.message : String(err),
      })
    }
    return null
  }
}

/**
 * Check Wikipedia for an article matching the brand name or any of its
 * aliases. Tries the brand's primary language first (when supplied),
 * then English / Italian / Swedish as fallbacks. Returns the first hit
 * — Wikipedia article presence is binary; one canonical match is enough.
 */
async function checkWikipedia(
  brandName: string,
  aliases: string[],
  preferredLang: string | null,
): Promise<PlatformPresence> {
  const candidates = wikipediaTitleCandidates(brandName, aliases)

  // Pick the order of language tries so the brand's own language is first.
  const langs = [...WIKI_LANGS_TO_TRY]
  if (preferredLang === 'it' || preferredLang === 'sv' || preferredLang === 'en') {
    langs.sort((a, b) => (a === preferredLang ? -1 : b === preferredLang ? 1 : 0))
  }

  for (const title of candidates) {
    for (const lang of langs) {
      const hit = await checkOneWikipediaLang(lang, title)
      if (hit) {
        return {
          found: true,
          url: hit.url,
          title: hit.canonicalTitle,
          note: `Matched Wikipedia (${lang}.wikipedia.org)`,
        }
      }
    }
  }

  return {
    found: false,
    url: null,
    title: null,
    note: `No Wikipedia article found for ${candidates.length} candidate title(s) across ${langs.join('/')}`,
  }
}

// ─── Reddit ────────────────────────────────────────────────────────────────
//
// Use Brave's existing `searchBrandRanking` helper with the query
// `site:reddit.com <brand>` to count how many Reddit pages mention the
// brand. Brave's organic results give us up to 20 hits; we count hits
// whose URL is on reddit.com.

async function checkReddit(brandName: string, language?: string | null): Promise<PlatformPresence> {
  if (!isBraveSearchAvailable()) {
    return {
      found: false,
      url: null,
      title: null,
      matchCount: 0,
      note: 'Brave Search not configured — Reddit presence check skipped',
    }
  }

  try {
    // searchBrandRanking takes (keyword, brandDomain, language). We pass
    // 'reddit.com' as the brandDomain — it returns the first position
    // hit + the organic results list. We then count distinct reddit.com
    // URLs in the response.
    const result = await searchBrandRanking(
      `site:reddit.com ${brandName}`,
      'reddit.com',
      language ?? undefined,
    )

    const redditUrls = result.organicResults
      .filter((r) => /(^|\.)reddit\.com\//i.test(r.url))
      .map((r) => r.url)

    if (redditUrls.length === 0) {
      return {
        found: false,
        url: null,
        title: null,
        matchCount: 0,
        note: 'No Reddit threads found via Brave site:reddit.com search',
      }
    }

    return {
      found: redditUrls.length >= 3, // Threshold: 1-2 mentions can be noise
      url: redditUrls[0] ?? null,
      title: result.organicResults[0]?.title ?? null,
      matchCount: redditUrls.length,
      note: `${redditUrls.length} Reddit URL${redditUrls.length === 1 ? '' : 's'} returned for site:reddit.com ${brandName}`,
    }
  } catch (err) {
    logger.warn('brand-presence: reddit check failed', {
      service: 'brand-presence',
      brand: brandName,
      err: err instanceof Error ? err.message : String(err),
    })
    return {
      found: false,
      url: null,
      title: null,
      matchCount: 0,
      note: `Reddit check failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ─── Composer ──────────────────────────────────────────────────────────────

/**
 * Check both Wikipedia and Reddit presence for a brand. Runs in parallel.
 * Returns a structured BrandPresence with `found` flags + diagnostic notes.
 * Soft-fails on errors (returns found: false with a note) — the caller
 * doesn't get crashes from network blips.
 */
export async function checkBrandPresence(
  brandName: string,
  aliases: string[] = [],
  language: string | null = null,
): Promise<BrandPresence> {
  const [wikipedia, reddit] = await Promise.all([
    checkWikipedia(brandName, aliases, language),
    checkReddit(brandName, language),
  ])
  return { wikipedia, reddit }
}
