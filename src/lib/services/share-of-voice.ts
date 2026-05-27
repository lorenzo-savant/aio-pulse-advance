// PATH: src/lib/services/share-of-voice.ts
//
// Share of Voice (SOV) — the standard competitive GEO/AEO benchmark: of all
// brand+competitor mentions across AI responses, what share is YOURS vs each
// rival, and how does that split move over time.
//
// Pure + deterministic (no DB/network) so it's unit-tested directly. The API
// route feeds it raw monitoring_results rows.

import type { CompetitorMention } from '@/types'

export interface SovInputRow {
  brand_mentioned: boolean | null
  mention_count: number | null
  mention_position: number | null
  competitor_mentions: CompetitorMention[] | null
  created_at: string | null
  /** AI engine that produced this row (chatgpt | gemini | perplexity | claude
   *  | …). Optional — only consumed by computeShareOfVoiceByEngine. */
  engine?: string | null
}

export interface SovEntity {
  name: string
  isBrand: boolean
  /** Total weighted mentions across the window. */
  mentions: number
  /** Share of all brand+competitor mentions, 0–100 (one decimal). */
  share: number
  /** % of responses that mentioned this entity, 0–100 (one decimal). */
  mentionRate: number
  /** Average answer position when mentioned (lower = better); null if never positioned. */
  avgPosition: number | null
  /** Population stddev of per-bucket share% across the timeline (0 when ≤1 bucket).
   *  Surfaces the "30% ± 10%" volatility industry research flags: LLMs are non-deterministic,
   *  so a point estimate hides whether the brand actually holds its share day to day. */
  volatility: number
  /** Min/max per-bucket share% observed, plus how many buckets had any responses. */
  range: { min: number; max: number; bucketsObserved: number }
}

export interface SovTimePoint {
  date: string
  /** entity name → share% on that day. Only the tracked entities appear. */
  shares: Record<string, number>
}

export interface ShareOfVoice {
  entities: SovEntity[]
  timeline: SovTimePoint[]
  totalResponses: number
  /** Names included in the timeline series (brand + top competitors). */
  series: string[]
}

const round1 = (v: number) => Math.round(v * 10) / 10

interface Tally {
  name: string
  isBrand: boolean
  mentions: number
  responses: number
  posSum: number
  posCount: number
}

function emptyTally(name: string, isBrand: boolean): Tally {
  return { name, isBrand, mentions: 0, responses: 0, posSum: 0, posCount: 0 }
}

function addPosition(t: Tally, position: number | null | undefined) {
  if (typeof position === 'number' && position > 0) {
    t.posSum += position
    t.posCount++
  }
}

export interface SovOptions {
  /** Max competitors to keep in the timeline series (by total mentions). Default 5. */
  maxSeries?: number
  /** Time bucket for the historical series. Default 'day'. */
  bucket?: 'day' | 'week'
}

/** Per-entity share volatility across the timeline. Pure aggregation over the
 *  same byDate map the timeline is built from, so every entity gets a stat
 *  (not just the ones inside the capped `series` list). */
function entityShareStats(
  byDate: Map<string, Map<string, number>>,
  key: string,
): { volatility: number; min: number; max: number; bucketsObserved: number } {
  const series: number[] = []
  for (const dayMap of byDate.values()) {
    let dayTotal = 0
    for (const v of dayMap.values()) dayTotal += v
    if (dayTotal <= 0) continue
    const m = dayMap.get(key) ?? 0
    series.push((m / dayTotal) * 100)
  }
  if (series.length === 0) {
    return { volatility: 0, min: 0, max: 0, bucketsObserved: 0 }
  }
  if (series.length === 1) {
    const only = round1(series[0]!)
    return { volatility: 0, min: only, max: only, bucketsObserved: 1 }
  }
  const mean = series.reduce((s, n) => s + n, 0) / series.length
  const variance = series.reduce((s, n) => s + (n - mean) ** 2, 0) / series.length
  return {
    volatility: round1(Math.sqrt(variance)),
    min: round1(Math.min(...series)),
    max: round1(Math.max(...series)),
    bucketsObserved: series.length,
  }
}

function bucketKey(iso: string, bucket: 'day' | 'week'): string {
  const day = iso.slice(0, 10)
  if (bucket === 'day') return day
  // ISO week start (Monday) — group dates into their week's Monday.
  const d = new Date(`${day}T00:00:00Z`)
  const dow = (d.getUTCDay() + 6) % 7 // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

/**
 * Compute Share of Voice for a brand against the competitors that actually
 * appear in its monitoring responses. Brand mentions come from
 * brand_mentioned/mention_count; competitor mentions from competitor_mentions.
 * Names are matched case-insensitively but displayed as first seen.
 */
export function computeShareOfVoice(
  rows: SovInputRow[],
  brandName: string,
  opts: SovOptions = {},
): ShareOfVoice {
  const maxSeries = opts.maxSeries ?? 5
  const bucket = opts.bucket ?? 'day'
  const brandKey = brandName.trim().toLowerCase()

  const tallies = new Map<string, Tally>()
  tallies.set(brandKey, emptyTally(brandName, true))

  // date → entityKey → mentions (for the timeline)
  const byDate = new Map<string, Map<string, number>>()
  let totalResponses = 0

  for (const row of rows) {
    totalResponses++
    const dateKey = row.created_at ? bucketKey(row.created_at, bucket) : null
    const dayMap = dateKey ? (byDate.get(dateKey) ?? new Map<string, number>()) : null
    if (dateKey && dayMap && !byDate.has(dateKey)) byDate.set(dateKey, dayMap)

    const bump = (
      key: string,
      name: string,
      isBrand: boolean,
      count: number,
      pos?: number | null,
    ) => {
      let t = tallies.get(key)
      if (!t) {
        t = emptyTally(name, isBrand)
        tallies.set(key, t)
      }
      t.mentions += count
      t.responses++
      addPosition(t, pos)
      if (dayMap) dayMap.set(key, (dayMap.get(key) ?? 0) + count)
    }

    if (row.brand_mentioned) {
      bump(brandKey, brandName, true, Math.max(row.mention_count ?? 1, 1), row.mention_position)
    }
    for (const cm of row.competitor_mentions ?? []) {
      const name = (cm?.name ?? '').trim()
      if (!name) continue
      const key = name.toLowerCase()
      if (key === brandKey) continue // never double-count the brand as its own competitor
      bump(key, name, false, Math.max(cm.count ?? 1, 1), cm.position)
    }
  }

  const all = [...tallies.values()]
  const totalMentions = all.reduce((s, t) => s + t.mentions, 0)

  const entities: SovEntity[] = all
    .map((t) => {
      const stats = entityShareStats(byDate, t.name.toLowerCase())
      return {
        name: t.name,
        isBrand: t.isBrand,
        mentions: t.mentions,
        share: totalMentions > 0 ? round1((t.mentions / totalMentions) * 100) : 0,
        mentionRate: totalResponses > 0 ? round1((t.responses / totalResponses) * 100) : 0,
        avgPosition: t.posCount > 0 ? round1(t.posSum / t.posCount) : null,
        volatility: stats.volatility,
        range: { min: stats.min, max: stats.max, bucketsObserved: stats.bucketsObserved },
      }
    })
    // Brand first, then competitors by descending share.
    .sort((a, b) => (a.isBrand === b.isBrand ? b.mentions - a.mentions : a.isBrand ? -1 : 1))

  // Timeline series: brand + the top competitors by total mentions.
  const seriesKeys = [
    brandKey,
    ...all
      .filter((t) => !t.isBrand)
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, maxSeries)
      .map((t) => t.name.toLowerCase()),
  ]
  const keyToName = new Map(all.map((t) => [t.name.toLowerCase(), t.name]))
  const series = seriesKeys.map((k) => keyToName.get(k) ?? k)

  const timeline: SovTimePoint[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayMap]) => {
      const dayTotal = [...dayMap.values()].reduce((s, n) => s + n, 0)
      const shares: Record<string, number> = {}
      for (const key of seriesKeys) {
        const name = keyToName.get(key) ?? key
        const m = dayMap.get(key) ?? 0
        shares[name] = dayTotal > 0 ? round1((m / dayTotal) * 100) : 0
      }
      return { date, shares }
    })

  return { entities, timeline, totalResponses, series }
}

// ─── Per-engine variant ────────────────────────────────────────────────────
// Closes the AEO gap: "share of voice — how often your brand appears
// relative to competitors ACROSS AI-GENERATED ANSWERS" (per platform).
// Each AI engine has its own retrieval + ranking behaviour, so an aggregate
// SoV hides where the brand is strong vs weak.

export interface SovEngineBreakdown extends ShareOfVoice {
  /** Engine label (chatgpt|gemini|perplexity|claude|unknown). */
  engine: string
}

export interface SovByEngineResult {
  /** Aggregate across all engines — same as computeShareOfVoice over rows. */
  overall: ShareOfVoice
  /** One entry per engine that produced at least one row. Sorted by total
   *  responses descending so the most-monitored engine leads. */
  byEngine: SovEngineBreakdown[]
}

/**
 * Group rows by engine and run computeShareOfVoice on each group, then run
 * it once more on the whole set for the aggregate. Pure aggregation, no
 * extra work beyond what computeShareOfVoice already does — just N+1 calls.
 */
export function computeShareOfVoiceByEngine(
  rows: SovInputRow[],
  brandName: string,
  opts: SovOptions = {},
): SovByEngineResult {
  const overall = computeShareOfVoice(rows, brandName, opts)

  const grouped = new Map<string, SovInputRow[]>()
  for (const row of rows) {
    const eng = (row.engine || 'unknown').toLowerCase()
    const list = grouped.get(eng) ?? []
    list.push(row)
    grouped.set(eng, list)
  }

  const byEngine: SovEngineBreakdown[] = [...grouped.entries()]
    .map(([engine, engineRows]) => ({
      engine,
      ...computeShareOfVoice(engineRows, brandName, opts),
    }))
    .sort((a, b) => b.totalResponses - a.totalResponses || a.engine.localeCompare(b.engine))

  return { overall, byEngine }
}
