// PATH: src/lib/services/fan-out.ts
//
// Query fan-out — extraction and measurement.
//
// When a question depends on what is true right now, an engine does not answer
// from memory: it expands the question into one to three real web searches and
// synthesises what it finds. Those search strings are what the brand actually
// competes for, and they are NOT the prompt we sent.
//
// Measured live 2026-08-19. Prompt:
//   "Vilka sajter är bäst för att köpa begagnad elektronik i Sverige 2026?"
// Gemini ran:
//   "basta sajter begagnad elektronik sverige"
//   "kop begagnad elektronik garanti sverige"
// Diacritics gone, the year gone, one question split into two searches, and a
// concept the prompt never contained ("garanti") introduced. A page optimised
// for the prompt wording is optimised for a string nobody searched. That gap is
// what `drift` below measures.
//
// Provider coverage, verified against live responses on 2026-08-19:
//   OpenAI Responses  → output[].type='web_search_call' → action.queries[]
//   Gemini Interactions → steps[].type='google_search_call' → arguments is a
//                         JSON *string* holding { queries: [...] }
//   Gemini generateContent (2.x) → groundingMetadata.webSearchQueries[]
//   Perplexity sonar  → NOT EXPOSED. Returns search_results and
//                       related_questions, never the queries it ran. Rows from
//                       Perplexity therefore carry NULL, and every count below
//                       reports that separately instead of scoring it as zero.
//
// Everything here is pure and deterministic — no DB, no network — so the
// arithmetic is unit-testable without fixtures, matching share-of-voice.ts.

/** Hard ceiling on stored queries per run. Observed fan-out is 1–3; the cap
 *  only exists so a malformed provider payload cannot write an unbounded
 *  array into every row. */
export const MAX_FANOUT_QUERIES_PER_RUN = 12

/** Longest single query we store. Real queries are short; anything longer is a
 *  provider returning prose into the wrong field. */
const MAX_QUERY_LENGTH = 300

// ─── Normalisation ──────────────────────────────────────────────────────────

/** Grouping key for "the same search". Case and whitespace are noise; accents
 *  are NOT stripped — engines strip them on their own and whether they did is
 *  itself a signal we want visible in the data. */
export function fanOutKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Clean a raw provider list into what we store: trimmed, deduplicated by key,
 *  bounded in length and count, original casing preserved for display. */
export function normalizeFanOutQueries(raw: readonly unknown[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed || trimmed.length > MAX_QUERY_LENGTH) continue
    const key = fanOutKey(trimmed)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
    if (out.length >= MAX_FANOUT_QUERIES_PER_RUN) break
  }
  return out
}

// ─── Per-provider extraction ────────────────────────────────────────────────

/** OpenAI Responses API: web_search_call items carry action.queries[] (plus a
 *  singular action.query mirroring the first). Both are read; dedup handles
 *  the overlap. */
export function extractOpenAIFanOut(output: unknown): string[] {
  if (!Array.isArray(output)) return []
  const raw: unknown[] = []
  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const o = item as { type?: unknown; action?: unknown }
    if (o.type !== 'web_search_call') continue
    const action = o.action as { queries?: unknown; query?: unknown } | undefined
    if (!action) continue
    if (Array.isArray(action.queries)) raw.push(...action.queries)
    if (typeof action.query === 'string') raw.push(action.query)
  }
  return normalizeFanOutQueries(raw)
}

/** Gemini Interactions API: google_search_call steps carry `arguments` as a
 *  JSON STRING, not an object — parsing it is the whole trick. A malformed
 *  payload yields nothing rather than throwing: losing one run's fan-out must
 *  never fail the monitoring run that produced it. */
export function extractGeminiInteractionsFanOut(steps: unknown): string[] {
  if (!Array.isArray(steps)) return []
  const raw: unknown[] = []
  for (const step of steps) {
    if (!step || typeof step !== 'object') continue
    const s = step as { type?: unknown; arguments?: unknown }
    if (s.type !== 'google_search_call') continue
    let parsed: unknown = s.arguments
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed)
      } catch {
        continue
      }
    }
    const queries = (parsed as { queries?: unknown } | undefined)?.queries
    if (Array.isArray(queries)) raw.push(...queries)
  }
  return normalizeFanOutQueries(raw)
}

/** Gemini generateContent (2.x legacy path): groundingMetadata.webSearchQueries
 *  is already a plain string array. This is the field ai-router declared in its
 *  response type and never read. */
export function extractGeminiGroundingFanOut(groundingMetadata: unknown): string[] {
  const meta = groundingMetadata as { webSearchQueries?: unknown } | undefined
  if (!meta || !Array.isArray(meta.webSearchQueries)) return []
  return normalizeFanOutQueries(meta.webSearchQueries)
}

// ─── Measurement ────────────────────────────────────────────────────────────

export interface FanOutRow {
  engine: string
  /** NULL = not captured (legacy row, or a provider that does not expose it).
   *  Empty array = the engine answered without searching. The two must not be
   *  merged: one is our blindness, the other is engine behaviour. */
  search_queries: string[] | null
  brand_mentioned: boolean | null
  cited_urls: string[] | null
  prompt_text?: string | null
}

export interface FanOutQueryStat {
  /** Most frequent original spelling seen for this search. */
  query: string
  /** Runs whose fan-out contained this search. */
  runs: number
  /** Engines that ran it, sorted. */
  engines: string[]
  /** Share of those runs where the brand was mentioned, 0-100. */
  mentionRate: number
  /** Share of those runs where the brand's own domain was cited, 0-100. */
  citationRate: number
  /** Distinct prompts that triggered this search (capped for display). */
  prompts: string[]
  /** 0-100. Token overlap distance between this search and the prompts that
   *  triggered it: 0 = the engine searched our wording, 100 = it searched
   *  something with no words in common. High drift means the page we tuned to
   *  the prompt is tuned to a string nobody searched. */
  drift: number
}

export interface FanOutReport {
  /** Runs that carried a fan-out array (captured or explicitly empty). */
  captured: number
  /** Runs with NULL — pre-capture history, or Perplexity, which never exposes
   *  its searches. Reported, never counted as zero searches. */
  notCaptured: number
  /** Runs the engine answered without searching at all. */
  searchless: number
  /** Average searches per run that actually searched. */
  expansionRatio: number
  queries: FanOutQueryStat[]
}

const WORD_RE = /[\p{L}\p{N}]+/gu

function tokens(text: string): Set<string> {
  return new Set((text.toLowerCase().match(WORD_RE) ?? []).filter((w) => w.length > 2))
}

/** Jaccard distance on word sets, 0-100. Deterministic and explainable: no
 *  stemming, no embeddings, no model call. Words of 1-2 characters are dropped
 *  so articles and prepositions do not inflate the overlap. */
export function driftBetween(query: string, prompt: string): number {
  const a = tokens(query)
  const b = tokens(prompt)
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  const union = a.size + b.size - shared
  if (union === 0) return 0
  return Math.round((1 - shared / union) * 100)
}

function ownDomainCited(citedUrls: string[] | null, ownDomain: string | null): boolean {
  if (!ownDomain || !citedUrls?.length) return false
  const own = ownDomain.replace(/^www\./i, '').toLowerCase()
  for (const u of citedUrls) {
    try {
      const host = new URL(u).hostname.replace(/^www\./i, '').toLowerCase()
      if (host === own || host.endsWith('.' + own)) return true
    } catch {
      /* engines emit fragments that are not URLs — skip, do not guess */
    }
  }
  return false
}

export interface FanOutOptions {
  /** Brand's own domain, for the citation rate. */
  ownDomain?: string | null
  /** Drop searches seen fewer times than this from the ranking. Default 1
   *  (keep everything) — a single occurrence is still a real observation, and
   *  callers that want signal-only can raise it. */
  minRuns?: number
  /** Cap on the returned ranking. */
  limit?: number
  /** Cap on distinct prompts listed per query. */
  maxPromptsPerQuery?: number
}

/**
 * Aggregate fan-out across monitoring rows into the ranked measurement.
 *
 * The ranking is by runs, then mention rate ascending: the searches an engine
 * runs most often AND where the brand appears least are the ones worth work.
 * A search with high runs and a high mention rate is a position to defend, not
 * a gap to close — both are visible, and the ordering surfaces the gaps first.
 */
export function buildFanOutReport(
  rows: readonly FanOutRow[],
  options: FanOutOptions = {},
): FanOutReport {
  const { ownDomain = null, minRuns = 1, limit = 50, maxPromptsPerQuery = 5 } = options

  let captured = 0
  let notCaptured = 0
  let searchless = 0
  let totalQueries = 0

  interface Acc {
    spellings: Map<string, number>
    runs: number
    engines: Set<string>
    mentioned: number
    cited: number
    prompts: Map<string, number>
  }
  const byQuery = new Map<string, Acc>()

  for (const row of rows) {
    if (row.search_queries == null) {
      notCaptured++
      continue
    }
    captured++
    if (row.search_queries.length === 0) {
      searchless++
      continue
    }
    totalQueries += row.search_queries.length

    const mentioned = row.brand_mentioned === true
    const cited = ownDomainCited(row.cited_urls, ownDomain)
    const prompt = row.prompt_text?.trim() || ''

    // Deduplicate within the row so one run counts once per distinct search.
    const seenInRow = new Set<string>()
    for (const q of row.search_queries) {
      const key = fanOutKey(q)
      if (!key || seenInRow.has(key)) continue
      seenInRow.add(key)

      let acc = byQuery.get(key)
      if (!acc) {
        acc = {
          spellings: new Map(),
          runs: 0,
          engines: new Set(),
          mentioned: 0,
          cited: 0,
          prompts: new Map(),
        }
        byQuery.set(key, acc)
      }
      acc.spellings.set(q, (acc.spellings.get(q) ?? 0) + 1)
      acc.runs++
      acc.engines.add(row.engine)
      if (mentioned) acc.mentioned++
      if (cited) acc.cited++
      if (prompt) acc.prompts.set(prompt, (acc.prompts.get(prompt) ?? 0) + 1)
    }
  }

  const queries: FanOutQueryStat[] = []
  for (const acc of byQuery.values()) {
    if (acc.runs < minRuns) continue
    const query = [...acc.spellings.entries()].sort((a, b) => b[1] - a[1])[0]![0]
    const prompts = [...acc.prompts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxPromptsPerQuery)
      .map(([p]) => p)
    // Drift against the prompt that most often triggered this search. Using the
    // top prompt rather than an average keeps the number interpretable: it is a
    // real pair the operator can read side by side.
    const drift = prompts.length ? driftBetween(query, prompts[0]!) : 0
    queries.push({
      query,
      runs: acc.runs,
      engines: [...acc.engines].sort(),
      mentionRate: Math.round((acc.mentioned / acc.runs) * 100),
      citationRate: Math.round((acc.cited / acc.runs) * 100),
      prompts,
      drift,
    })
  }

  queries.sort((a, b) => b.runs - a.runs || a.mentionRate - b.mentionRate)

  const searching = captured - searchless
  return {
    captured,
    notCaptured,
    searchless,
    expansionRatio: searching > 0 ? Math.round((totalQueries / searching) * 10) / 10 : 0,
    queries: queries.slice(0, limit),
  }
}
