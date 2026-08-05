// PATH: src/lib/services/competitor-identity.ts
//
// Who counts as a competitor.
//
// `competitor_mentions` is written straight from the model's JSON with no
// validation — `z.string()` and into the row. The brand's own
// `brand.competitors` list is handed to the prompt as context and then never
// used to check anything, so every name a model invents has been receiving
// market share, a rank, a timeline and a place in the executive summary. The
// monitoring prompt actively encourages this: it asks for "similar brands".
//
// The fix is to decide identity at READ time rather than to filter at write
// time. That matters for one specific reason: ~1700 historical rows already
// exist, and a stored `verified` flag would be absent on every one of them, so
// any consumer that trusted the flag would silently reinterpret the entire
// archive. Matching on read gives old and new rows the same treatment, needs no
// migration and no backfill, and stays correct when the declared list is later
// edited — change the brand's competitors and every past report re-reads
// consistently.
//
// Nothing is discarded. A discovered name is still a real observation and may
// be a competitor nobody thought to declare; it is reported as `discovered`,
// and it keeps its weight in the denominator so shares still add up. What it
// does NOT get is a rank, a market share of its own, or a sentence in the
// summary asserting the client is losing to it.

import { stripLegalSuffix } from '@/lib/brand-aliases'

/**
 * Fold a brand-ish name to a comparison key: case, punctuation, whitespace and
 * a trailing legal suffix are all noise when deciding whether two strings name
 * the same company. "Acast AB", "acast", "ACAST." → "acast".
 */
export function normalizeEntityName(name: string): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return ''
  const withoutSuffix = stripLegalSuffix(trimmed) ?? trimmed
  return withoutSuffix
    .toLowerCase()
    .replace(/[.,/()&'"`´’-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface CompetitorMatcher {
  /** True when the declared list is empty — callers should then treat every
   *  mention as unclassified rather than as "all discovered", because a brand
   *  with no declared competitors has not told us anything to match against. */
  readonly hasDeclaredList: boolean
  /** The canonical declared spelling for a mention, or null if not declared. */
  canonical(name: string): string | null
  isDeclared(name: string): boolean
}

/**
 * Build a matcher from a brand's declared competitor list.
 *
 * Aliases are folded in the same way the brand's own aliases are, so a declared
 * "Acast AB" matches a mention of "Acast" and vice versa.
 */
export function buildCompetitorMatcher(declared: readonly string[] | null): CompetitorMatcher {
  const byKey = new Map<string, string>()

  for (const raw of declared ?? []) {
    const name = (raw ?? '').trim()
    if (!name) continue
    const key = normalizeEntityName(name)
    if (!key) continue
    // First spelling wins, so the canonical form is the one the user typed.
    if (!byKey.has(key)) byKey.set(key, name)
  }

  return {
    hasDeclaredList: byKey.size > 0,
    canonical(name: string) {
      return byKey.get(normalizeEntityName(name)) ?? null
    },
    isDeclared(name: string) {
      return byKey.has(normalizeEntityName(name))
    },
  }
}

export interface ClassifiedMention {
  /** Canonical declared name when declared, otherwise the name as observed. */
  name: string
  declared: boolean
}

/**
 * Classify one observed name against the declared list.
 *
 * With no declared list, `declared` is false for everything — but callers must
 * read that as "unknown", not as "invented". `hasDeclaredList` is how they tell
 * the two apart, and consumers that would otherwise hide unclassified names
 * should fall back to showing them rather than showing nothing at all.
 */
export function classifyMention(matcher: CompetitorMatcher, name: string): ClassifiedMention {
  const canonical = matcher.canonical(name)
  return canonical ? { name: canonical, declared: true } : { name: name.trim(), declared: false }
}
