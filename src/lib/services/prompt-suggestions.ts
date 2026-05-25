// PATH: src/lib/services/prompt-suggestions.ts
//
// Turns the "related questions" AI engines surface (currently Perplexity's
// return_related_questions — free, no extra key) into clean, deduplicated
// prompt suggestions the user can add to their monitoring set. These are the
// queries real users ask next about a topic, so they make excellent prompts.
//
// Pure + dependency-free: unit-tested without network and reusable by any
// caller (API route / UI panel).

export interface PromptSuggestion {
  /** The suggested prompt text, original casing preserved. */
  text: string
  /** Which engine surfaced it (provenance for the UI). */
  source: string
}

/** Normalize for dedupe only: lowercase, collapse spaces, drop trailing punctuation. */
function normalizeForDedupe(q: string): string {
  return q
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[?.!\s]+$/, '')
}

/**
 * Lowercase + collapse whitespace. Used by the relevance filter so that
 * anchor matching is case- and spacing-insensitive.
 */
function lc(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Whether a related question is "on-topic" for the brand. A question passes
 * if it contains AT LEAST ONE anchor — typically the brand name, an alias,
 * or a meaningful industry/category keyword. Empty anchor list = no filter
 * (caller didn't supply context → pass everything, legacy behavior).
 *
 * We require anchor length ≥ 3 to avoid spurious matches on stop-words
 * like "ai" or "se" appearing inside larger phrases.
 */
function passesRelevance(question: string, anchors: string[]): boolean {
  if (anchors.length === 0) return true
  const q = lc(question)
  for (const a of anchors) {
    const anchor = lc(a)
    if (anchor.length < 3) continue
    if (q.includes(anchor)) return true
  }
  return false
}

/**
 * Convert raw related questions into prompt suggestions, deduped against the
 * brand's existing prompts (and against each other), with trivial entries
 * filtered out. Order is preserved (engines return them by relevance).
 *
 * `relevanceAnchors` (optional) is a list of brand-specific terms (name,
 * aliases, industry keywords). When supplied, suggestions that mention none
 * of them are dropped — this prevents context leak when the seed query
 * happens to be off-topic for the brand (e.g. a generic marketing-agency
 * prompt seeded against a casting-platform brand).
 */
export function relatedQuestionsToPromptSuggestions(
  related: string[],
  existingPromptTexts: string[] = [],
  opts: {
    source?: string
    max?: number
    minLength?: number
    relevanceAnchors?: string[]
  } = {},
): PromptSuggestion[] {
  const source = opts.source ?? 'perplexity'
  const max = opts.max ?? 10
  const minLength = opts.minLength ?? 8
  const anchors = opts.relevanceAnchors ?? []

  const existing = new Set(existingPromptTexts.map(normalizeForDedupe))
  const seen = new Set<string>()
  const out: PromptSuggestion[] = []

  for (const raw of related) {
    if (typeof raw !== 'string') continue
    const text = raw.trim().replace(/\s+/g, ' ')
    const key = normalizeForDedupe(text)
    if (key.length < minLength) continue // too short to be a meaningful query
    if (existing.has(key) || seen.has(key)) continue // dedupe vs existing + self
    if (!passesRelevance(text, anchors)) continue // off-topic for this brand
    seen.add(key)
    out.push({ text, source })
    if (out.length >= max) break
  }

  return out
}
