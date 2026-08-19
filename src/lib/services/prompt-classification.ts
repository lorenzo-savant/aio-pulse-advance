// PATH: src/lib/services/prompt-classification.ts
//
// Branded vs discovery prompts — computed from the prompt TEXT, not from its
// category.
//
// WHY THE TEXT AND NOT THE CATEGORY
// Two reasons, both practical. The category is user-entered and, on real
// brands, largely unset or defaulted (Relovie: 51 of 61 prompts sit in
// 'awareness', 10 have none) — a filter built on it would silently sort noise.
// And the text is retroactive: every stored row already carries prompt_text, so
// the split applies to the whole history the day it ships, with no backfill and
// no migration.
//
// WHY THE SPLIT MATTERS
// A question that already names the brand is a different population from one
// that does not. Measured on Relovie: 100% mention rate on branded questions
// against 57.4% on discovery ones. Averaging the two hides the only number that
// moves — an engine that always mentions you when asked about you tells you
// nothing about whether it finds you when it is not. Semrush computes its
// Perception sentiment on non-branded queries only, and calls that the single
// most important detail of its sentiment documentation.
//
// The matching itself is not reimplemented here: detectBrandMention already
// does Unicode-aware whole-word matching over free text, and it is the same
// guard that keeps "Acast" from matching inside "Acasting". A second
// word-boundary implementation would be a second thing to get wrong.

import { detectBrandMention } from './brand-mention'

export type PromptScope = 'all' | 'branded' | 'non_branded'

export const PROMPT_SCOPES: readonly PromptScope[] = ['all', 'branded', 'non_branded']

export function isPromptScope(value: unknown): value is PromptScope {
  return typeof value === 'string' && (PROMPT_SCOPES as readonly string[]).includes(value)
}

export interface BrandNaming {
  name: string
  aliases?: readonly string[] | null
  /** Optional: a prompt naming the site ("what does relovie.se sell?") is as
   *  branded as one naming the company. */
  domain?: string | null
}

/**
 * True when the prompt text names the brand, one of its aliases, or its domain.
 *
 * Whole-word and case-insensitive, accent-safe through the shared detector.
 * Deterministic: the same prompt always classifies the same way, which is what
 * makes the split usable as a filter over stored history.
 */
export function isBrandedPrompt(
  promptText: string | null | undefined,
  brand: BrandNaming,
): boolean {
  const text = (promptText ?? '').trim()
  if (!text || !brand?.name?.trim()) return false
  return detectBrandMention(text, {
    name: brand.name,
    aliases: [...(brand.aliases ?? [])],
    domain: brand.domain ?? null,
  }).brandMentioned
}

export interface ScopedRows<T> {
  /** The rows the requested scope keeps. */
  rows: T[]
  /** How many rows named the brand, over the whole input. */
  brandedCount: number
  /** How many did not, over the whole input. */
  nonBrandedCount: number
}

/**
 * Split rows by whether their prompt named the brand, and return the slice the
 * scope asks for.
 *
 * Both counts are always reported, whichever scope was requested: a filtered
 * average is only readable next to how much of the data it covers. A brand with
 * three discovery prompts out of sixty should be able to see that.
 */
export function scopeRowsByBrandedness<T extends { prompt_text?: string | null }>(
  rows: readonly T[],
  brand: BrandNaming,
  scope: PromptScope,
): ScopedRows<T> {
  const branded: T[] = []
  const nonBranded: T[] = []

  for (const row of rows) {
    if (isBrandedPrompt(row.prompt_text, brand)) branded.push(row)
    else nonBranded.push(row)
  }

  const rowsForScope =
    scope === 'branded' ? branded : scope === 'non_branded' ? nonBranded : [...rows]

  return {
    rows: rowsForScope,
    brandedCount: branded.length,
    nonBrandedCount: nonBranded.length,
  }
}

// ─── Category classification ────────────────────────────────────────────────
//
// C4 in the anomaly report: 51 of 61 Relovie prompts sit in 'awareness' and 10
// carry no category at all, so any per-category analysis reads noise. Two
// halves to the fix — the API now requires a category (see /api/prompts), and
// the flows that create a prompt without a form need something better than a
// silent default. That is what this is.
//
// It is deterministic and conservative on purpose. It only claims a category
// when the text carries an actual signal, in any of the three product
// languages; everything else lands in 'custom', which is the enum's
// uncategorised bucket. Guessing 'awareness' for anything unrecognised is
// precisely how the column became meaningless the first time.

export type PromptCategory = 'awareness' | 'comparison' | 'alternative' | 'features' | 'custom'

/** Word-ish signals per category. Matched case-insensitively as substrings of a
 *  space-padded, lowercased prompt, so short tokens like ' vs ' cannot fire
 *  inside another word. */
const CATEGORY_SIGNALS: Array<{ category: PromptCategory; needles: string[] }> = [
  {
    category: 'comparison',
    needles: [
      ' vs ',
      ' vs.',
      'versus',
      'compared to',
      'comparison',
      'difference between',
      'differ from',
      'differs from',
      'better than',
      ' contro ',
      'confronto',
      'differenza tra',
      'si differenzia',
      'meglio di',
      'jämfört',
      'jämför',
      'skillnad mellan',
      'skiljer sig',
      'bättre än',
    ],
  },
  {
    category: 'alternative',
    needles: [
      'alternative',
      'alternatives',
      'instead of',
      'similar to',
      'alternativa',
      'alternative a',
      'al posto di',
      'simile a',
      'alternativ',
      'i stället för',
      'liknande',
    ],
  },
  {
    category: 'features',
    needles: [
      'feature',
      'features',
      'does it support',
      'how does',
      'pricing',
      'how much',
      'integration',
      'funzionalità',
      'caratteristiche',
      'quanto costa',
      'prezzi',
      'come funziona',
      'funktion',
      'funktioner',
      'vad kostar',
      'priser',
      'hur fungerar',
    ],
  },
]

/** 'A or B — which is best?' carries no comparison keyword but is one. The
 *  disjunction alone is far too common to use, so it only counts next to a
 *  superlative. Surfaced by running the backfill over real stored prompts. */
function isDisjunctiveComparison(haystack: string): boolean {
  const hasDisjunction = [' eller ', ' oppure ', ' or ', ' o '].some((d) => haystack.includes(d))
  if (!hasDisjunction) return false
  return ['bäst', 'bättre', 'best', 'better', 'meglio', 'migliore'].some((w) =>
    haystack.includes(w),
  )
}

/**
 * Best-effort category for a prompt whose creator never picked one.
 *
 * Precedence is comparison → alternative → features → awareness (the brand is
 * named) → custom. A prompt that both names the brand and compares it is a
 * comparison: the sharper signal wins, because that is the one a reader would
 * act on.
 */
export function classifyPromptCategory(
  promptText: string | null | undefined,
  brand: BrandNaming,
): PromptCategory {
  const text = (promptText ?? '').trim()
  if (!text) return 'custom'
  const haystack = ` ${text.toLowerCase()} `

  for (const { category, needles } of CATEGORY_SIGNALS) {
    if (needles.some((n) => haystack.includes(n))) return category
  }
  if (isDisjunctiveComparison(haystack)) return 'comparison'
  if (isBrandedPrompt(text, brand)) return 'awareness'
  return 'custom'
}
