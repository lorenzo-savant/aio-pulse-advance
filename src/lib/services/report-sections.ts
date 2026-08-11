// PATH: src/lib/services/report-sections.ts
//
// Pure section builders for the brand report (/api/reports/html).
//
// The report used to show four sections — AVI components, domain SoAIV,
// a competitor table and a sentiment heatmap — while the product computed far
// more than that on its dashboard surfaces: per-engine breakdowns, cited
// domains with authority categories, keywords, GEO pillars, share of voice,
// and the full answer texts. All of it lived in the database and none of it
// reached the one artifact a customer actually forwards to their boss.
//
// Everything here is a pure function over rows the route already fetches, so
// each section is testable without a database and the route stays an
// assembler.

import { classifyDomainAuthority, type DomainCategory } from '@/lib/utils/ai-trust-score'

/** The slice of a monitoring_results row the report sections consume. */
export interface ReportResultRow {
  engine: string
  brand_mentioned: boolean | null
  mention_position: number | null
  mention_count?: number | null
  visibility_score: number | null
  sentiment: string | null
  sentiment_score: number | null
  cited_urls: string[] | null
  competitor_mentions: Array<{
    name: string
    position?: number | null
    count?: number | null
  }> | null
  response_text?: string | null
  prompt_id?: string | null
  created_at: string | null
}

// ── per-engine breakdown ─────────────────────────────────────────────────────

export interface EngineBreakdown {
  engine: string
  total: number
  mentioned: number
  mentionRate: number
  /** Average sentence index of the first mention, mentioned rows only. */
  positionAvg: number | null
  visibilityAvg: number
  sentiment: { positive: number; neutral: number; negative: number }
}

/**
 * Per-engine stats over the whole window.
 *
 * Engines below `minRows` are dropped rather than shown: a provider that
 * produced three responses in the period (an exhausted API key, a mid-window
 * enablement) would otherwise print an authoritative-looking 100% built on
 * nothing, and a report cannot footnote its way out of that.
 */
export function buildEngineBreakdown(rows: ReportResultRow[], minRows = 10): EngineBreakdown[] {
  const byEngine = new Map<string, ReportResultRow[]>()
  for (const r of rows) {
    const list = byEngine.get(r.engine) ?? []
    list.push(r)
    byEngine.set(r.engine, list)
  }

  const out: EngineBreakdown[] = []
  for (const [engine, list] of byEngine) {
    if (list.length < minRows) continue
    const mentioned = list.filter((r) => r.brand_mentioned).length
    const positioned = list.filter((r) => r.brand_mentioned && r.mention_position != null)
    const sent = { positive: 0, neutral: 0, negative: 0 }
    for (const r of list)
      if (r.sentiment && r.sentiment in sent) sent[r.sentiment as keyof typeof sent]++
    out.push({
      engine,
      total: list.length,
      mentioned,
      mentionRate: Math.round((mentioned / list.length) * 100),
      positionAvg: positioned.length
        ? Math.round(
            (positioned.reduce((s, r) => s + (r.mention_position ?? 0), 0) / positioned.length) *
              10,
          ) / 10
        : null,
      visibilityAvg: Math.round(
        list.reduce((s, r) => s + (r.visibility_score ?? 0), 0) / list.length,
      ),
      sentiment: sent,
    })
  }
  return out.sort((a, b) => b.total - a.total)
}

// ── cited domains ────────────────────────────────────────────────────────────

export interface CitedDomain {
  domain: string
  count: number
  category: DomainCategory
  isOwn: boolean
}

export interface CitedDomainsSection {
  top: CitedDomain[]
  /** Citation counts grouped by authority category, descending. */
  byCategory: Array<{ category: DomainCategory; count: number }>
  totalCitations: number
}

/** Which domains the engines link as sources, ranked, with authority categories. */
export function buildCitedDomains(
  rows: ReportResultRow[],
  brandDomain: string | null,
  topN = 10,
): CitedDomainsSection {
  const counts = new Map<string, number>()
  for (const r of rows) {
    for (const u of r.cited_urls ?? []) {
      try {
        const d = new URL(u).hostname.replace(/^www\./, '').toLowerCase()
        counts.set(d, (counts.get(d) ?? 0) + 1)
      } catch {
        /* not a URL — engines sometimes emit fragments; skip rather than guess */
      }
    }
  }

  const own = (brandDomain ?? '').replace(/^www\./, '').toLowerCase()
  const all = [...counts.entries()].sort((a, b) => b[1] - a[1])

  const catCounts = new Map<DomainCategory, number>()
  for (const [d, n] of all) {
    const c = classifyDomainAuthority(d)
    catCounts.set(c, (catCounts.get(c) ?? 0) + n)
  }

  return {
    top: all.slice(0, topN).map(([domain, count]) => ({
      domain,
      count,
      category: classifyDomainAuthority(domain),
      isOwn: own !== '' && (domain === own || domain.endsWith('.' + own)),
    })),
    byCategory: [...catCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    totalCitations: all.reduce((s, [, n]) => s + n, 0),
  }
}

// ── prompts with their answers ───────────────────────────────────────────────

export interface PromptAnswer {
  engine: string
  mentioned: boolean
  mentionPosition: number | null
  sentiment: string | null
  visibility: number | null
  responseText: string
  citedUrls: string[]
  date: string
}

export interface PromptWithAnswers {
  promptId: string
  text: string
  category: string | null
  language: string | null
  runs: number
  mentionRate: number
  /** Latest answer per engine, engines ordered by the caller's engine order. */
  answers: PromptAnswer[]
}

/**
 * Every prompt that has results, with the LATEST full answer from each engine.
 *
 * Latest-per-engine rather than the whole history: the appendix answers "what
 * do the engines say about us today", and a report that reprints thirty runs
 * of the same prompt buries that under its own archaeology. Prompts with no
 * results are omitted entirely — an empty block is a to-do list item, not
 * report content.
 */
export function buildPromptAnswers(
  rows: ReportResultRow[],
  prompts: Array<{ id: string; text: string; category?: string | null; language?: string | null }>,
  engineOrder: string[],
): PromptWithAnswers[] {
  const byPrompt = new Map<
    string,
    { total: number; mentioned: number; latest: Map<string, ReportResultRow> }
  >()
  const sorted = [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  for (const r of sorted) {
    if (!r.prompt_id) continue
    const p = byPrompt.get(r.prompt_id) ?? { total: 0, mentioned: 0, latest: new Map() }
    p.total++
    if (r.brand_mentioned) p.mentioned++
    if (!p.latest.has(r.engine)) p.latest.set(r.engine, r)
    byPrompt.set(r.prompt_id, p)
  }

  return prompts
    .filter((p) => byPrompt.has(p.id))
    .map((p) => {
      const s = byPrompt.get(p.id)!
      const answers: PromptAnswer[] = []
      for (const engine of engineOrder) {
        const r = s.latest.get(engine)
        if (!r || !r.response_text) continue
        answers.push({
          engine,
          mentioned: !!r.brand_mentioned,
          mentionPosition: r.mention_position ?? null,
          sentiment: r.sentiment ?? null,
          visibility: r.visibility_score ?? null,
          responseText: r.response_text,
          citedUrls: (r.cited_urls ?? []).slice(0, 6),
          date: String(r.created_at ?? '').slice(0, 10),
        })
      }
      return {
        promptId: p.id,
        text: p.text,
        category: p.category ?? null,
        language: p.language ?? null,
        runs: s.total,
        mentionRate: Math.round((s.mentioned / s.total) * 100),
        answers,
      }
    })
    .filter((p) => p.answers.length > 0)
    .sort((a, b) => b.mentionRate - a.mentionRate || b.runs - a.runs)
}
