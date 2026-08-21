/**
 * Grounding layer for the answer agents.
 *
 * The product measures how accurately AI engines describe a brand. An advisor
 * that invents an explanation would undermine exactly that claim, so answers
 * here are assembled from rows, never generated from a blank context:
 *
 *  - every fact carries the table it came from (see `Provenance`)
 *  - definitions come from SECTION_HELP, so a term like "Citation Rate" always
 *    means what the app actually computes rather than what a model assumes
 *  - when the query returns nothing the caller gets a refusal, and the model is
 *    never asked — this is enforced here in code, not requested in a prompt
 *
 * Read-only by construction: this module only ever issues `.select()`.
 */
import { createServerClient } from '@/lib/supabase'
import { SECTION_HELP, type HelpLocale } from '@/lib/data/section-help'

/** The five GEO pillars, as keyed by the geo-score service. */
export const PILLARS = ['citation', 'presence', 'authority', 'position', 'trust'] as const
export type Pillar = (typeof PILLARS)[number]

export function isPillar(value: string): value is Pillar {
  return (PILLARS as readonly string[]).includes(value)
}

/** Where a fact came from. Mirrors the `provenance` line in the Brand Report. */
export interface Provenance {
  /** Table the rows were read from. */
  table: string
  /** Human-readable note on the slice that was read. */
  detail: string
  /** How many rows backed the fact — 0 can never reach the model. */
  rowCount: number
}

export interface Evidence {
  /** Plain statements of fact, each already true of the rows that were read. */
  facts: string[]
  /** Definitions lifted verbatim from SECTION_HELP, never paraphrased upstream. */
  definitions: string[]
  provenance: Provenance[]
}

export type Grounded =
  | { grounded: true; evidence: Evidence }
  | { grounded: false; reason: RefusalReason }

/** Why an answer could not be grounded. Callers surface these verbatim. */
export type RefusalReason =
  | 'no_database'
  | 'no_monitoring_data'
  | 'no_snapshots'
  | 'not_enough_history'

/**
 * Which monitoring signal actually drives each pillar. Kept next to the query
 * that reads it so an attribution answer can never cite a column the score does
 * not depend on.
 */
const PILLAR_SIGNAL: Record<Pillar, string> = {
  citation: 'cited_urls',
  presence: 'brand_mentioned',
  authority: 'mention_type',
  position: 'mention_position',
  trust: 'has_hallucination',
}

/** Pulls the metric definitions for a dashboard section, in the user's locale. */
export function definitionsFor(section: string, locale: HelpLocale): string[] {
  const help = SECTION_HELP[section]?.[locale]
  if (!help) return []
  return help.metrics.map((m) => `${m.metric} — ${m.meaning} ${m.howMeasured} (${m.range})`)
}

function sinceIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * Answers "why is this pillar the number it is" by reading the individual
 * responses that fed it, rather than restating the aggregate the dashboard
 * already shows.
 */
export async function collectAttributionEvidence(
  brandId: string,
  pillar: Pillar,
  days: number,
  locale: HelpLocale,
): Promise<Grounded> {
  const db = createServerClient()
  if (!db) return { grounded: false, reason: 'no_database' }

  const since = sinceIso(days)
  const { data, error } = await db
    .from('monitoring_results')
    .select(
      'engine, prompt_text, brand_mentioned, mention_position, mention_type, cited_urls, has_hallucination, confusion_flag, confusion_reason, created_at',
    )
    .eq('brand_id', brandId)
    .gte('created_at', since)

  // A failed read is indistinguishable from "no evidence" for the caller: in
  // both cases we must not let a model fill the gap.
  if (error || !data || data.length === 0) {
    return { grounded: false, reason: 'no_monitoring_data' }
  }

  const total = data.length
  const facts: string[] = []

  switch (pillar) {
    case 'citation': {
      const cited = data.filter((r) => Array.isArray(r.cited_urls) && r.cited_urls.length > 0)
      facts.push(`${cited.length} of ${total} responses cite at least one source.`)
      break
    }
    case 'presence': {
      const mentioned = data.filter((r) => r.brand_mentioned)
      facts.push(`The brand is named in ${mentioned.length} of ${total} responses.`)
      const silentEngines = [
        ...new Set(data.filter((r) => !r.brand_mentioned).map((r) => r.engine)),
      ]
      if (silentEngines.length) {
        facts.push(`Responses without a mention come from: ${silentEngines.join(', ')}.`)
      }
      break
    }
    case 'authority': {
      const recommended = data.filter((r) => r.mention_type === 'recommendation')
      facts.push(
        `${recommended.length} of ${total} responses recommend the brand rather than only naming it.`,
      )
      break
    }
    case 'position': {
      const positioned = data.filter(
        (r) => typeof r.mention_position === 'number' && r.mention_position > 0,
      )
      if (positioned.length === 0) {
        facts.push(`No response in the period records a mention position.`)
      } else {
        const late = positioned.filter((r) => (r.mention_position as number) > 5)
        const avg =
          positioned.reduce((sum, r) => sum + (r.mention_position as number), 0) / positioned.length
        facts.push(`Average first-mention position is sentence ${avg.toFixed(1)}.`)
        facts.push(`${late.length} of ${positioned.length} mentions land after the fifth sentence.`)
      }
      break
    }
    case 'trust': {
      const hallucinated = data.filter((r) => r.has_hallucination)
      facts.push(`${hallucinated.length} of ${total} responses contain a flagged inaccuracy.`)
      break
    }
  }

  // Category confusion is not a pillar of its own, but it explains a depressed
  // score across several of them — surface it whenever it is present.
  const confused = data.filter((r) => r.confusion_flag)
  if (confused.length > 0) {
    const reasons = [...new Set(confused.map((r) => r.confusion_reason).filter(Boolean))]
    facts.push(
      `${confused.length} of ${total} responses are flagged as describing a different entity.`,
    )
    if (reasons.length) facts.push(`Recorded reason: ${reasons.slice(0, 3).join('; ')}.`)
  }

  const examples = data
    .filter((r) => r.prompt_text)
    .slice(0, 3)
    .map((r) => `"${String(r.prompt_text).slice(0, 120)}" (${r.engine})`)
  if (examples.length) facts.push(`Example prompts read: ${examples.join(' · ')}.`)

  return {
    grounded: true,
    evidence: {
      facts,
      definitions: definitionsFor('geo-score', locale),
      provenance: [
        {
          table: 'monitoring_results',
          detail: `${PILLAR_SIGNAL[pillar]} over the last ${days} days`,
          rowCount: total,
        },
      ],
    },
  }
}

/**
 * Answers "what changed and why" by diffing two stored snapshots. Deliberately
 * refuses on a single snapshot: one point is not a trend, and narrating it as
 * one is the failure mode this layer exists to prevent.
 */
export async function collectDeltaEvidence(
  brandId: string,
  days: number,
  locale: HelpLocale,
): Promise<Grounded> {
  const db = createServerClient()
  if (!db) return { grounded: false, reason: 'no_database' }

  const { data, error } = await db
    .from('geo_score_snapshots')
    .select('score, grade, delta, pillars, sample_size, confidence, snapshot_date')
    .eq('brand_id', brandId)
    .gte('snapshot_date', sinceIso(days))
    .order('snapshot_date', { ascending: false })

  if (error || !data || data.length === 0) return { grounded: false, reason: 'no_snapshots' }
  if (data.length < 2) return { grounded: false, reason: 'not_enough_history' }

  const latest = data[0]!
  const earlier = data[data.length - 1]!
  const facts: string[] = [
    `Score moved from ${Number(earlier.score).toFixed(1)} to ${Number(latest.score).toFixed(1)} between ${String(earlier.snapshot_date).slice(0, 10)} and ${String(latest.snapshot_date).slice(0, 10)}.`,
    `Current grade is ${latest.grade}.`,
  ]

  // Attribute the move to individual pillars so the answer says which lever
  // shifted, not merely that the total changed.
  const pillarsOf = (row: unknown): Record<string, number> => {
    const raw = (row as { pillars?: unknown }).pillars
    if (!raw || typeof raw !== 'object') return {}
    const out: Record<string, number> = {}
    for (const entry of Array.isArray(raw) ? raw : Object.values(raw)) {
      const p = entry as { key?: string; score?: number }
      if (p?.key && typeof p.score === 'number') out[p.key] = p.score
    }
    return out
  }

  const now = pillarsOf(latest)
  const before = pillarsOf(earlier)
  const moves = Object.keys(now)
    .filter((k) => k in before)
    .map((k) => ({ key: k, change: now[k]! - before[k]! }))
    .filter((m) => Math.abs(m.change) >= 1)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))

  for (const m of moves.slice(0, 3)) {
    facts.push(`Pillar ${m.key} moved ${m.change > 0 ? '+' : ''}${m.change.toFixed(1)} points.`)
  }
  if (moves.length === 0) facts.push('No individual pillar moved by a full point.')

  // Sample size decides whether the delta is worth acting on at all.
  if (latest.sample_size != null) {
    facts.push(
      `The latest score is backed by ${latest.sample_size} responses (confidence: ${latest.confidence ?? 'unknown'}).`,
    )
  }

  return {
    grounded: true,
    evidence: {
      facts,
      definitions: definitionsFor('geo-score', locale),
      provenance: [
        {
          table: 'geo_score_snapshots',
          detail: `${data.length} snapshots over the last ${days} days`,
          rowCount: data.length,
        },
      ],
    },
  }
}

/**
 * Recommendations already delivered to this brand. Read so an answer does not
 * re-suggest work the client has been told about — the quickest way to lose
 * credibility in a client-facing tool.
 */
export async function collectDeliveredRecommendations(
  brandId: string,
  days: number,
): Promise<{ titles: string[]; provenance: Provenance }> {
  const db = createServerClient()
  const empty = {
    titles: [],
    provenance: { table: 'recommendation_history', detail: 'unavailable', rowCount: 0 },
  }
  if (!db) return empty

  const { data, error } = await db
    .from('recommendation_history')
    .select('recommendations, created_at')
    .eq('brand_id', brandId)
    .gte('created_at', sinceIso(days))
    .order('created_at', { ascending: false })
    .limit(20)

  if (error || !data?.length) return empty

  // `recommendations` is a jsonb array whose items carry a `title`; read it
  // defensively so a shape change degrades to "no titles" instead of throwing.
  const titles = data.flatMap((row) => {
    const raw = (row as { recommendations?: unknown }).recommendations
    if (!Array.isArray(raw)) return []
    return raw
      .map((item) => (item as { title?: unknown })?.title)
      .filter((t): t is string => typeof t === 'string' && t.length > 0)
  })

  return {
    titles,
    provenance: {
      table: 'recommendation_history',
      detail: `recommendations delivered in the last ${days} days`,
      rowCount: data.length,
    },
  }
}
