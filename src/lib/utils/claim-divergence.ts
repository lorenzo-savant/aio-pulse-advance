// Cross-engine claim divergence detector.
//
// Pure util. Given the responses from multiple AI engines for the same
// prompt, extracts simple factual claims (founding year, HQ city,
// pricing tier, founder name, team size) via regex and flags cases
// where engines disagree. Used by /api/claim-divergence to surface the
// "AI gets X wrong" angle from the industry brand-misinformation
// playbook — without any extra LLM calls.
//
// Trade-off: regex extraction misses everything outside the patterns
// (a deliberate choice — we want precision over recall for a panel
// that demands operator review). False positives are far worse here
// than missed claims.

export type ClaimType =
  | 'founding_year'
  | 'headquarters'
  | 'founder'
  | 'team_size'
  | 'pricing'
  | 'funding'

export interface ExtractedClaim {
  type: ClaimType
  value: string
  // The 80-char window the claim was extracted from, for operator
  // review (so they don't have to dig through the full response).
  context: string
}

export interface EngineClaims {
  engine: string
  claims: ExtractedClaim[]
}

export interface ClaimDivergence {
  type: ClaimType
  // Distinct normalised values seen across engines, with which engines
  // claimed each. Engines absent from any bucket simply didn't make a
  // claim of this type — only treat as divergence when ≥2 buckets exist.
  buckets: Array<{
    value: string
    engines: string[]
    contexts: string[]
  }>
}

const NEAR_WINDOW = 80

function windowAround(text: string, idx: number, len: number): string {
  const start = Math.max(0, idx - NEAR_WINDOW)
  const end = Math.min(text.length, idx + len + NEAR_WINDOW)
  return text.slice(start, end).replace(/\s+/g, ' ').trim()
}

// founding year — "founded in 2018", "established 2015", "since 1999",
// "launched in 2020". Year band kept tight to avoid catching arbitrary
// years (publication dates, etc.). Multilingual: en + it + sv.
const FOUNDING_YEAR_RE =
  /\b(?:founded|established|launched|started|since|grundades|grundad|fondata|fondato|fondazione|nata\s+nel|fundada\s+en)\s+(?:in\s+|on\s+|nel\s+|i\s+)?(\d{4})\b/gi

// headquarters / based in city. Captures the city only — we deliberately
// drop ", Country" suffixes so "Stockholm, Sweden" and "Stockholm" end
// up in the same bucket. Bias towards English/Italian/Swedish phrasing.
const HEADQUARTERS_RE =
  /\b(?:headquartered\s+in|based\s+in|hq\s+in|located\s+in|con\s+sede\s+a|sede\s+a|med\s+(?:huvudkontor\s+i|säte\s+i)|baserat\s+i)\s+([A-ZÅÄÖÉ][a-zA-ZåäöéèìòùÀÁÈÉÌÒÙ]{1,30})/gi

// founder — "founded by [Name Name]", "founded in 2018 by [Name]",
// "founder [Name]" etc. Captures up to 3 capitalised words.
const FOUNDER_RE =
  /\b(?:founded(?:\s+(?:in\s+)?\d{4})?\s+by|co-?founded\s+by|founder(?:\s+is)?|fondato\s+da|fondatore|grundades\s+av|grundare(?:n)?\s+är)\s+([A-Z][a-zA-ZåäöéèìòùÀÁÈÉÌÒÙ'-]+(?:\s+[A-Z][a-zA-ZåäöéèìòùÀÁÈÉÌÒÙ'-]+){0,2})/g

// team size — "team of 50", "50 employees", "more than 200 people".
const TEAM_SIZE_RE =
  /\b(?:team\s+of|with\s+(?:a\s+)?team\s+of|over|more\s+than|approximately|around|~)?\s*(\d{2,5})\+?\s*(?:employees|people|staff|team\s+members|dipendenti|anställda)\b/gi

// pricing — "starts at $99", "from €19/month", "priced at $X".
const PRICING_RE =
  /\b(?:starts?\s+at|starting\s+from|from|priced\s+at|costs?|prezzo\s+da|prijs\s+vanaf|priser\s+från)\s+([$€£¥₹](?:\d{1,5}(?:[.,]\d{1,4})?(?:\s?[KMk])?))/g

// funding rounds — "raised $50M", "Series B of $20M", "$100 million in
// funding". Captures the dollar amount.
const FUNDING_RE =
  /\b(?:raised|secured|series\s+[A-D][\s-]?(?:funding|round)|funding\s+round\s+of|hanno\s+raccolto|raccolti)\s+\$?(\d{1,4}(?:\.\d+)?\s*(?:million|billion|M|B|mln|mld)\b)/gi

function extractMatches(
  text: string,
  re: RegExp,
  type: ClaimType,
  normalize: (raw: string) => string,
): ExtractedClaim[] {
  const out: ExtractedClaim[] = []
  let m: RegExpExecArray | null
  re.lastIndex = 0
  while ((m = re.exec(text))) {
    const raw = m[1]
    if (!raw) continue
    out.push({
      type,
      value: normalize(raw),
      context: windowAround(text, m.index, m[0].length),
    })
  }
  return out
}

function normYear(raw: string): string {
  const y = parseInt(raw, 10)
  if (Number.isFinite(y) && y >= 1850 && y <= 2099) return String(y)
  return raw.trim()
}

function normCity(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase())
}

function normPerson(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

function normSize(raw: string): string {
  return String(parseInt(raw, 10))
}

function normPrice(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase().replace(',', '.')
}

function normFunding(raw: string): string {
  return raw
    .replace(/\s+/g, '')
    .replace(/million|mln/i, 'M')
    .replace(/billion|mld/i, 'B')
    .toUpperCase()
}

export function extractClaims(text: string): ExtractedClaim[] {
  if (!text || text.length < 20) return []
  return [
    ...extractMatches(text, FOUNDING_YEAR_RE, 'founding_year', normYear),
    ...extractMatches(text, HEADQUARTERS_RE, 'headquarters', normCity),
    ...extractMatches(text, FOUNDER_RE, 'founder', normPerson),
    ...extractMatches(text, TEAM_SIZE_RE, 'team_size', normSize),
    ...extractMatches(text, PRICING_RE, 'pricing', normPrice),
    ...extractMatches(text, FUNDING_RE, 'funding', normFunding),
  ]
}

export interface ResponseForDivergence {
  engine: string
  responseText: string
}

// For one prompt's set of engine responses, return the divergences
// (claim types where ≥2 different normalised values appear across
// engines). Each divergence carries the engines that claimed each
// value so the panel can render the contradiction.
export function findDivergencesForPrompt(responses: ResponseForDivergence[]): ClaimDivergence[] {
  const perEngine: EngineClaims[] = responses.map((r) => ({
    engine: r.engine,
    claims: extractClaims(r.responseText),
  }))

  // Build map: claimType → value → engines + contexts
  type Bucket = { engines: Set<string>; contexts: string[] }
  const byType = new Map<ClaimType, Map<string, Bucket>>()
  for (const ec of perEngine) {
    // Within a single engine response, the SAME claim may appear
    // multiple times — dedupe so we don't double-count.
    const seenForEngine = new Set<string>()
    for (const c of ec.claims) {
      const key = `${c.type}::${c.value}`
      if (seenForEngine.has(key)) continue
      seenForEngine.add(key)

      let valueMap = byType.get(c.type)
      if (!valueMap) {
        valueMap = new Map<string, Bucket>()
        byType.set(c.type, valueMap)
      }
      let bucket = valueMap.get(c.value)
      if (!bucket) {
        bucket = { engines: new Set<string>(), contexts: [] }
        valueMap.set(c.value, bucket)
      }
      bucket.engines.add(ec.engine)
      if (bucket.contexts.length < 3) bucket.contexts.push(c.context)
    }
  }

  const divergences: ClaimDivergence[] = []
  for (const [type, valueMap] of byType.entries()) {
    if (valueMap.size < 2) continue
    divergences.push({
      type,
      buckets: Array.from(valueMap.entries())
        .map(([value, bucket]) => ({
          value,
          engines: Array.from(bucket.engines).sort(),
          contexts: bucket.contexts,
        }))
        .sort((a, b) => b.engines.length - a.engines.length),
    })
  }
  return divergences
}

export interface PromptDivergence {
  promptId: string
  promptText: string | null
  divergences: ClaimDivergence[]
}

export interface DivergenceReport {
  prompts: PromptDivergence[]
  // Roll-up: count of prompts where each claim type diverges.
  totals: Record<ClaimType, number>
}

export interface MonitoringRowForDivergence {
  prompt_id: string | null
  prompt_text?: string | null
  engine: string
  response_text: string | null
}

export function buildDivergenceReport(rows: MonitoringRowForDivergence[]): DivergenceReport {
  const byPrompt = new Map<string, MonitoringRowForDivergence[]>()
  for (const r of rows) {
    if (!r.prompt_id || !r.response_text) continue
    let arr = byPrompt.get(r.prompt_id)
    if (!arr) {
      arr = []
      byPrompt.set(r.prompt_id, arr)
    }
    arr.push(r)
  }

  const totals: Record<ClaimType, number> = {
    founding_year: 0,
    headquarters: 0,
    founder: 0,
    team_size: 0,
    pricing: 0,
    funding: 0,
  }
  const prompts: PromptDivergence[] = []

  for (const [promptId, group] of byPrompt.entries()) {
    if (group.length < 2) continue
    const divergences = findDivergencesForPrompt(
      group.map((r) => ({ engine: r.engine, responseText: r.response_text || '' })),
    )
    if (divergences.length === 0) continue
    const first = group[0]
    prompts.push({
      promptId,
      promptText: first?.prompt_text ?? null,
      divergences,
    })
    for (const d of divergences) totals[d.type]++
  }

  prompts.sort((a, b) => b.divergences.length - a.divergences.length)
  return { prompts, totals }
}
