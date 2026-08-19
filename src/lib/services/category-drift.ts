// PATH: src/lib/services/category-drift.ts
//
// Category drift — does the engine describe the brand as the thing it IS?
//
// A brand competes inside a category. If Relovie is a price meta-search across
// used-goods sellers but the engines answer as though it were "a used-clothing
// shop", it is cited for the wrong intent: visible on queries that do not
// convert, absent from the ones that would. Nothing stated is false, so this is
// NOT a hallucination — it is a positioning signal, and it is measurable.
//
// Deterministic on purpose: token-overlap distance (Jaccard), no embeddings and
// no model call — the same method fan-out.ts uses for query drift, so the number
// is explainable and unit-testable without fixtures. Lexical, not semantic: it
// flags a pair for a human to read, it does not adjudicate meaning.

const WORD_RE = /[\p{L}\p{N}]+/gu

/** Content words only: lowercased, 1–2 char tokens dropped so articles and
 *  prepositions do not inflate the overlap. Diacritics are kept — whether the
 *  engine stripped them is itself signal, matching fan-out.ts. */
function tokens(text: string): Set<string> {
  return new Set((text.toLowerCase().match(WORD_RE) ?? []).filter((w) => w.length > 2))
}

/**
 * 0–100 token-overlap distance between how the engine described the brand and
 * the brand's real category. 0 = the same words, 100 = nothing in common.
 *
 * Returns `null` when either side has no scoreable words — that is "unknown",
 * which must never be read as "0 drift" (the fan-out module keeps the same
 * distinction between blindness and a real zero).
 */
export function categoryDrift(describedAs: string, actualCategory: string): number | null {
  const a = tokens(describedAs)
  const b = tokens(actualCategory)
  if (a.size === 0 || b.size === 0) return null
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  const union = a.size + b.size - shared
  if (union === 0) return null
  return Math.round((1 - shared / union) * 100)
}

export type CategoryFit = 'aligned' | 'drifting' | 'mismatch' | 'unknown'

/**
 * Bucket the drift for display. Thresholds are deliberate: a brand described in
 * words that barely overlap its real category is a mismatch worth surfacing, not
 * a rounding error. Because the distance is lexical, inflection-heavy languages
 * (Swedish köpa/köp, Italian) read higher than the meaning warrants — read
 * `mismatch` as a flag for review, never as a verdict.
 */
export function classifyCategoryFit(
  drift: number | null,
  opts: { driftingAt?: number; mismatchAt?: number } = {},
): CategoryFit {
  const { driftingAt = 40, mismatchAt = 70 } = opts
  if (drift === null) return 'unknown'
  if (drift >= mismatchAt) return 'mismatch'
  if (drift >= driftingAt) return 'drifting'
  return 'aligned'
}
