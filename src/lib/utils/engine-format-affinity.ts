// PATH: src/lib/utils/engine-format-affinity.ts
//
// Pure analyser that cross-tabs AI engine vs cited content KIND (blog /
// docs / product / support / other) so the operator can see which engine
// prefers which content format from a domain.
//
// Closes the gap from the industry research "LLM Prompt Tracking" piece:
//   "The fix was to rewrite their existing high-converting pages in forms
//    each of the other LLMs would prefer: a Reddit Q&A thread for
//    Perplexity, a page with a listicle for ChatGPT, a blog post for
//    Gemini talking about alternatives to the client's product."
//
// What this does:
//   - Walks monitoring_results-style rows (engine + cited_urls[]).
//   - Classifies each cited URL by KIND via citation-depth.classifyCitationKind.
//   - Builds an engine × format matrix of citation counts + share %.
//   - Picks the dominant format per engine + the dominant engine per format.
//
// Pure, no network, no LLM, no dependency. Mirrors the posture of
// citation-classifier.ts / citation-depth.ts.

import { classifyCitationKind, type CitationKind } from './citation-depth'

export type Engine = string // 'chatgpt' | 'gemini' | 'perplexity' | 'claude' | 'unknown' | …

export interface FormatAffinityInput {
  engine: string | null
  cited_urls: string[] | null
}

const KINDS: CitationKind[] = ['blog', 'docs', 'product', 'support', 'other']

export interface FormatBreakdown {
  blog: number
  docs: number
  product: number
  support: number
  other: number
}

export interface EngineFormatRow {
  engine: Engine
  /** Total cited URLs counted for this engine in the window. */
  totalCitations: number
  /** Raw counts per kind. */
  counts: FormatBreakdown
  /** Share % per kind, 1 decimal (sums to ~100 unless totalCitations=0). */
  shares: FormatBreakdown
  /** The kind this engine cites most often. null when totalCitations=0. */
  dominantFormat: CitationKind | null
  /** Numeric share of the dominant format (mirror of shares[dominantFormat]). */
  dominantShare: number
}

export interface FormatLeaderRow {
  format: CitationKind
  /** Engine that cites this format most often. null when nobody cites it. */
  leadingEngine: Engine | null
  /** Share % of this engine's citations that go to this format. */
  leadingShare: number
  /** Total citations of this format across all engines. */
  total: number
}

export interface FormatAffinityReport {
  /** One row per engine with the per-format breakdown. */
  engines: EngineFormatRow[]
  /** One row per format with the engine that leads on it. */
  formatLeaders: FormatLeaderRow[]
  /** Total citations counted across all engines × all formats. */
  totalCitations: number
}

function emptyBreakdown(): FormatBreakdown {
  return { blog: 0, docs: 0, product: 0, support: 0, other: 0 }
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

/**
 * Build the engine × format affinity matrix.
 *
 * @param rows monitoring rows with engine + cited_urls[]
 * @param opts.ownedDomain — when set, only URLs on this domain are counted.
 *                          Useful to ask "which of MY formats does each
 *                          engine prefer?" instead of "which formats in
 *                          general get cited?". Default: count everything.
 */
export function computeEngineFormatAffinity(
  rows: FormatAffinityInput[],
  opts: { ownedDomain?: string } = {},
): FormatAffinityReport {
  const ownedDomain =
    opts.ownedDomain
      ?.toLowerCase()
      .replace(/^www\./, '')
      .trim() || null

  // engine → kind → count
  const byEngine = new Map<string, FormatBreakdown>()

  for (const row of rows) {
    const eng = (row.engine || 'unknown').toLowerCase()
    const urls = Array.isArray(row.cited_urls) ? row.cited_urls : []
    let bucket = byEngine.get(eng)
    if (!bucket) {
      bucket = emptyBreakdown()
      byEngine.set(eng, bucket)
    }
    for (const rawUrl of urls) {
      if (typeof rawUrl !== 'string' || rawUrl.length === 0) continue
      if (ownedDomain) {
        try {
          const host = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`).hostname
            .toLowerCase()
            .replace(/^www\./, '')
          if (host !== ownedDomain && !host.endsWith(`.${ownedDomain}`)) continue
        } catch {
          continue
        }
      }
      const kind = classifyCitationKind(rawUrl)
      bucket[kind]++
    }
  }

  // Engines list with shares + dominant format.
  const engines: EngineFormatRow[] = [...byEngine.entries()]
    .map(([engine, counts]) => {
      const total = counts.blog + counts.docs + counts.product + counts.support + counts.other
      const shares: FormatBreakdown = emptyBreakdown()
      let dominantFormat: CitationKind | null = null
      let dominantCount = 0
      for (const k of KINDS) {
        shares[k] = total > 0 ? round1((counts[k] / total) * 100) : 0
        if (counts[k] > dominantCount) {
          dominantCount = counts[k]
          dominantFormat = k
        }
      }
      return {
        engine,
        totalCitations: total,
        counts,
        shares,
        dominantFormat,
        dominantShare: dominantFormat ? shares[dominantFormat] : 0,
      }
    })
    .sort((a, b) => b.totalCitations - a.totalCitations || a.engine.localeCompare(b.engine))

  // Per-format leader: which engine cites this format the most (by share),
  // and what's the cross-engine total for this format?
  const formatLeaders: FormatLeaderRow[] = KINDS.map((format) => {
    let total = 0
    let leadingEngine: Engine | null = null
    let leadingShare = 0
    for (const row of engines) {
      total += row.counts[format]
      // Engine must actually cite the format at least once to be a "leader".
      if (row.counts[format] > 0 && row.shares[format] > leadingShare) {
        leadingShare = row.shares[format]
        leadingEngine = row.engine
      }
    }
    return { format, leadingEngine, leadingShare, total }
  }).sort((a, b) => b.total - a.total)

  const totalCitations = engines.reduce((s, e) => s + e.totalCitations, 0)
  return { engines, formatLeaders, totalCitations }
}
