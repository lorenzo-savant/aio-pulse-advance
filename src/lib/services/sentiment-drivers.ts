// PATH: src/lib/services/sentiment-drivers.ts
//
// "Key Sentiment Drivers" — closes the Semrush AI-SoV-article gap:
// the Perception report flags WHICH aspects of a brand drive positive vs
// negative AI portrayal ("strong praise for ease of use, no-code automations;
// gaps in depth, advanced controls, learning curve").
//
// Per response that mentions the brand, take a ±N-token window around each
// mention, classify which BUSINESS DRIVERS appear in that window (reusing
// DRIVER_DEFINITIONS — already trilingual EN/IT/SV), then score the window
// with the existing lexical sentiment engine. Aggregate per driver:
// pos/neg/neu counts + average score = key sentiment drivers for the brand.
//
// Pure + deterministic (no DB/network). The API route feeds it raw
// monitoring_results rows.

import {
  DRIVER_DEFINITIONS,
  type DriverDefinition,
  type DriverId,
} from '@/lib/utils/business-drivers'
import { lexicalSentiment } from './sentiment-lexicon'

export interface SentimentDriverRow {
  brand_mentioned: boolean | null
  response_text: string | null
  /** Authoritative LLM sentiment score in [-1, 1] (preferred when present). */
  sentiment_score: number | null
  /** Result id — surfaced back as `sampleResponseIds` for drill-down. */
  id?: string | null
  created_at?: string | null
}

export interface SentimentDriver {
  id: DriverId
  label: string
  /** Total windows that matched this driver. */
  mentions: number
  pos: number
  neg: number
  neu: number
  /** Average sentiment of matching windows, [-1, 1] rounded to 2 dp. */
  avgScore: number
  /** Up to 3 result ids that hit this driver, for drill-down. */
  sampleResponseIds: string[]
}

export interface SentimentDriversResult {
  /** Drivers leading positive perception (avgScore ≥ +0.15, mentions ≥ min). */
  positive: SentimentDriver[]
  /** Drivers dragging perception down (avgScore ≤ -0.15, mentions ≥ min). */
  negative: SentimentDriver[]
  /** Drivers seen but with mixed/neutral signal. */
  neutral: SentimentDriver[]
  totalResponses: number
  /** Responses that produced at least one driver window. */
  responsesWithDriver: number
}

export interface SentimentDriversOptions {
  /** Words on either side of the brand mention to scan. Default 25. */
  windowTokens?: number
  /** Skip drivers with fewer than this many windows. Default 2. */
  minMentions?: number
  /** Threshold for pos/neg labelling — matches sentiment-lexicon defaults. */
  threshold?: number
  /** Extra brand spellings to match (e.g. legal name, domain, ticker). */
  aliases?: string[]
}

const round2 = (v: number) => Math.round(v * 100) / 100

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Split text into word-ish tokens preserving order. Cheap whitespace split
 * — we just need indices for windowing, not linguistic accuracy.
 */
function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

function brandHitIndices(tokensNorm: string[], brandKeys: string[]): number[] {
  if (brandKeys.length === 0) return []
  // Brand keys can be single-token ("acasting.se") OR multi-token ("Savant
  // Media"). For multi-token we scan contiguous windows and yield the
  // middle token's index. For single-token, exact OR substring match
  // (handles "acasting.se", "@acasting", possessives, …).
  const hits = new Set<number>()
  for (const key of brandKeys) {
    const parts = key.split(/\s+/).filter(Boolean)
    if (parts.length === 0) continue
    if (parts.length === 1) {
      const k = parts[0]!
      for (let i = 0; i < tokensNorm.length; i++) {
        const t = tokensNorm[i]!
        if (t === k || t.includes(k)) hits.add(i)
      }
    } else {
      for (let i = 0; i <= tokensNorm.length - parts.length; i++) {
        let matched = true
        for (let j = 0; j < parts.length; j++) {
          const tok = tokensNorm[i + j]!
          const part = parts[j]!
          if (tok !== part && !tok.includes(part)) {
            matched = false
            break
          }
        }
        if (matched) hits.add(i + Math.floor(parts.length / 2))
      }
    }
  }
  return [...hits].sort((a, b) => a - b)
}

function driverHitsInWindow(windowText: string): Set<DriverId> {
  const norm = normalize(windowText)
  const hits = new Set<DriverId>()
  for (const def of DRIVER_DEFINITIONS) {
    for (const kw of def.keywords) {
      const k = normalize(kw).trim()
      if (k.length === 0) continue
      if (norm.includes(k)) {
        hits.add(def.id)
        break
      }
    }
  }
  return hits
}

interface Tally {
  def: DriverDefinition
  mentions: number
  pos: number
  neg: number
  neu: number
  scoreSum: number
  scoreCount: number
  sampleIds: Set<string>
}

function emptyTally(def: DriverDefinition): Tally {
  return {
    def,
    mentions: 0,
    pos: 0,
    neg: 0,
    neu: 0,
    scoreSum: 0,
    scoreCount: 0,
    sampleIds: new Set(),
  }
}

/**
 * Build "key sentiment drivers" for a brand from monitoring responses.
 * For each response that mentions the brand, scan a window around each
 * mention, classify drivers in that window, and score it with the
 * trilingual lexical sentiment engine (or the row's LLM sentiment_score
 * when present and stronger).
 */
export function extractSentimentDrivers(
  rows: SentimentDriverRow[],
  brandName: string,
  opts: SentimentDriversOptions = {},
): SentimentDriversResult {
  const windowTokens = Math.max(5, opts.windowTokens ?? 25)
  const minMentions = Math.max(1, opts.minMentions ?? 2)
  const threshold = opts.threshold ?? 0.15
  const brandKeys = [brandName, ...(opts.aliases ?? [])]
    .map((s) => normalize(s).trim())
    .filter((s) => s.length >= 3)

  const tallies = new Map<DriverId, Tally>()
  for (const def of DRIVER_DEFINITIONS) tallies.set(def.id, emptyTally(def))

  let totalResponses = 0
  let responsesWithDriver = 0

  for (const row of rows) {
    totalResponses++
    if (!row.brand_mentioned) continue
    const text = (row.response_text || '').trim()
    if (!text || brandKeys.length === 0) continue

    const tokens = tokenize(text)
    if (tokens.length === 0) continue
    const tokensNorm = tokens.map(normalize)
    const hits = brandHitIndices(tokensNorm, brandKeys)
    if (hits.length === 0) continue

    // Merge overlapping windows so a single mention cluster is one signal,
    // not many — avoids double-counting "BrandX (... BrandX)" prose.
    interface Range {
      start: number
      end: number
    }
    const ranges: Range[] = []
    for (const idx of hits) {
      const start = Math.max(0, idx - windowTokens)
      const end = Math.min(tokens.length, idx + windowTokens + 1)
      const last = ranges[ranges.length - 1]
      if (last && start <= last.end) {
        last.end = Math.max(last.end, end)
      } else {
        ranges.push({ start, end })
      }
    }

    let rowProducedDriver = false
    for (const r of ranges) {
      const windowText = tokens.slice(r.start, r.end).join(' ')
      const driverIds = driverHitsInWindow(windowText)
      if (driverIds.size === 0) continue

      // Window-local lexical sentiment. Fall back to (or blend with) the
      // row's LLM sentiment_score when the lexicon has no signal — the
      // LLM call already saw the full context.
      const lex = lexicalSentiment(windowText)
      let score = lex.score
      if (lex.hits === 0 && typeof row.sentiment_score === 'number') {
        score = row.sentiment_score
      } else if (typeof row.sentiment_score === 'number' && lex.hits > 0) {
        // Blend: lexicon for window-local signal, LLM for response context.
        score = (lex.score + row.sentiment_score) / 2
      }
      const label: 'positive' | 'negative' | 'neutral' =
        score > threshold ? 'positive' : score < -threshold ? 'negative' : 'neutral'

      for (const id of driverIds) {
        const t = tallies.get(id)
        if (!t) continue
        t.mentions++
        if (label === 'positive') t.pos++
        else if (label === 'negative') t.neg++
        else t.neu++
        t.scoreSum += score
        t.scoreCount++
        if (row.id && t.sampleIds.size < 3) t.sampleIds.add(row.id)
        rowProducedDriver = true
      }
    }
    if (rowProducedDriver) responsesWithDriver++
  }

  const all: SentimentDriver[] = [...tallies.values()]
    .filter((t) => t.mentions >= minMentions)
    .map((t) => ({
      id: t.def.id,
      label: t.def.label,
      mentions: t.mentions,
      pos: t.pos,
      neg: t.neg,
      neu: t.neu,
      avgScore: t.scoreCount > 0 ? round2(t.scoreSum / t.scoreCount) : 0,
      sampleResponseIds: [...t.sampleIds],
    }))

  const positive = all
    .filter((d) => d.avgScore >= threshold)
    .sort((a, b) => b.avgScore - a.avgScore || b.mentions - a.mentions)
  const negative = all
    .filter((d) => d.avgScore <= -threshold)
    .sort((a, b) => a.avgScore - b.avgScore || b.mentions - a.mentions)
  const neutral = all
    .filter((d) => d.avgScore > -threshold && d.avgScore < threshold)
    .sort((a, b) => b.mentions - a.mentions)

  return { positive, negative, neutral, totalResponses, responsesWithDriver }
}
