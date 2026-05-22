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
 * Convert raw related questions into prompt suggestions, deduped against the
 * brand's existing prompts (and against each other), with trivial entries
 * filtered out. Order is preserved (engines return them by relevance).
 */
export function relatedQuestionsToPromptSuggestions(
  related: string[],
  existingPromptTexts: string[] = [],
  opts: { source?: string; max?: number; minLength?: number } = {},
): PromptSuggestion[] {
  const source = opts.source ?? 'perplexity'
  const max = opts.max ?? 10
  const minLength = opts.minLength ?? 8

  const existing = new Set(existingPromptTexts.map(normalizeForDedupe))
  const seen = new Set<string>()
  const out: PromptSuggestion[] = []

  for (const raw of related) {
    if (typeof raw !== 'string') continue
    const text = raw.trim().replace(/\s+/g, ' ')
    const key = normalizeForDedupe(text)
    if (key.length < minLength) continue // too short to be a meaningful query
    if (existing.has(key) || seen.has(key)) continue // dedupe vs existing + self
    seen.add(key)
    out.push({ text, source })
    if (out.length >= max) break
  }

  return out
}
