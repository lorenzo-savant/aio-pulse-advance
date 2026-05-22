// PATH: src/lib/services/brand-mention.ts
//
// Deterministic brand-mention detection + URL extraction — the "deterministic
// pass" of a two-pass scoring pipeline (pattern borrowed from aeosudit).
//
// Why deterministic: whether a brand appears, how often, and which URLs the
// answer contains are EXACT-MATCH questions. An LLM following prose rules gets
// these wrong (it under-counts "Savant Media" when the brand is "Savant Media
// AB", or invents cited_urls that were never in the text). Regex whole-word
// matching is both cheaper and more reliable, and the whole-word boundary is
// exactly the look-alike guard the analysis prompt was trying to enforce
// ("Acast" never matches inside "Acasting"). The LLM is then left to do only
// what genuinely needs reasoning (sentiment, hallucination, competitors).
//
// Pure + Unicode-aware (handles å/ä/ö) so it's unit-tested without network.

export interface BrandMatchInput {
  name: string
  aliases?: string[]
  domain?: string | null
}

export interface BrandMentionResult {
  brandMentioned: boolean
  /** Total whole-word occurrences of the name + aliases (+ domain hits). */
  mentionCount: number
  /** 1-based sentence index of the FIRST mention (how early it appears), or null. */
  mentionPosition: number | null
  /** direct = primary name matched; indirect = only an alias/domain matched. */
  mentionType: 'direct' | 'indirect' | 'none'
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Unicode-aware whole-word matcher: the term must not be flanked by a letter or
// number (so "Acast" won't match inside "Acasting", and "ä/ö" boundaries work).
function wholeWordRegex(term: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(term)}(?![\\p{L}\\p{N}])`, 'giu')
}

function countMatches(text: string, re: RegExp): { count: number; firstIndex: number } {
  let count = 0
  let firstIndex = -1
  for (const m of text.matchAll(re)) {
    count++
    if (firstIndex === -1) firstIndex = m.index ?? -1
  }
  return { count, firstIndex }
}

function cleanDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
}

/** 1-based index of the sentence that contains `charIndex`. */
function sentenceIndexOf(text: string, charIndex: number): number {
  if (charIndex <= 0) return 1
  const before = text.slice(0, charIndex)
  const terminators = before.match(/[.!?]\s|\n+/g)
  return Math.min((terminators?.length ?? 0) + 1, 20)
}

/**
 * Detect whether a brand is mentioned in a response, how many times, how early,
 * and whether the match was the primary name (direct) or only an alias/domain
 * (indirect). Whole-word + Unicode aware; case-insensitive.
 */
export function detectBrandMention(text: string, brand: BrandMatchInput): BrandMentionResult {
  const body = text || ''
  if (!body.trim() || !brand.name?.trim()) {
    return { brandMentioned: false, mentionCount: 0, mentionPosition: null, mentionType: 'none' }
  }

  let total = 0
  let earliest = -1
  let nameMatched = false

  const consider = (count: number, firstIndex: number, isName: boolean) => {
    if (count <= 0) return
    total += count
    if (isName) nameMatched = true
    if (firstIndex >= 0 && (earliest === -1 || firstIndex < earliest)) earliest = firstIndex
  }

  // Primary name (whole word).
  const nameHit = countMatches(body, wholeWordRegex(brand.name.trim()))
  consider(nameHit.count, nameHit.firstIndex, true)

  // Aliases (whole word) — these are "indirect" matches.
  for (const alias of brand.aliases ?? []) {
    const a = alias.trim()
    if (!a) continue
    const hit = countMatches(body, wholeWordRegex(a))
    consider(hit.count, hit.firstIndex, false)
  }

  // Domain — matched as a substring (domains aren't word-bounded the same way),
  // guarded so "acme.com" isn't matched inside "notacme.com".
  if (brand.domain) {
    const dom = cleanDomain(brand.domain)
    if (dom.includes('.')) {
      const hit = countMatches(body, new RegExp(`(?<![\\p{L}\\p{N}.@])${escapeRegex(dom)}`, 'giu'))
      consider(hit.count, hit.firstIndex, false)
    }
  }

  if (total === 0) {
    return { brandMentioned: false, mentionCount: 0, mentionPosition: null, mentionType: 'none' }
  }
  return {
    brandMentioned: true,
    mentionCount: total,
    mentionPosition: sentenceIndexOf(body, earliest),
    mentionType: nameMatched ? 'direct' : 'indirect',
  }
}

/**
 * Extract real http(s) URLs present in the text (trailing punctuation trimmed).
 * These are actual links the answer contained — not LLM-invented citations.
 */
export function extractUrlsFromText(text: string): string[] {
  const out: string[] = []
  const re = /https?:\/\/[^\s<>"'`)\]}]+/gi
  for (const m of (text || '').matchAll(re)) {
    const url = m[0].replace(/[.,;:!?)\]}'"]+$/, '')
    if (url.length > 8) out.push(url)
  }
  return out
}
