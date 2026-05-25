// PATH: src/lib/services/brave-search.ts
//
// Brave Search API wrapper — PRIMARY SERP provider as of v2.1.0+.
//
// Strategy decision (see ~/.claude/projects/.../memory/project_api_strategy.md):
// Brave is the primary provider — 2k queries/month free recurring, AI-native,
// "honest substitute" for Google AI Overview via the Summarizer endpoint.
// Serper.dev is the paid tier when Brave free runs out (separate provider).
//
// Brave sells Search (web/news/images) and AI/Summarizer (Answer/grounding)
// as SEPARATE subscriptions, each with its own API key + quota. We support
// two independent key pools:
//   - "search" pool → web/search, news/search, images/search, …
//                     env: BRAVE_SEARCH_API_KEY (+ optional ..._API_KEYS list)
//   - "answer" pool → summarizer/search (the Answer / AI summary endpoint)
//                     env: BRAVE_ANSWER_API_KEY (+ optional ..._API_KEYS list)
// Legacy single-key callers can still set BRAVE_API_KEYS / BRAVE_API_KEY —
// when neither pool-specific var is set, the legacy var feeds both pools.
//
// Resilience pattern is INTRA-PROVIDER, not multi-provider rotation:
//   - 429 (rate limit): exponential backoff with jitter (1s → 2s → 4s → 8s),
//     max 4 attempts.
//   - 5xx / network timeout: retry up to 3 times.
//   - 200 with empty/invalid schema: log warn + return empty (NEVER fake success).
//   - Monthly quota exhausted: throw BraveQuotaExceeded → caller degrades
//     gracefully ("data not fresh", not crash).
//   - Brave free hard cap = 1 query/sec. App-level rate limiter enforced here.

import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { withSerpCache } from './serp-cache'

const BRAVE_BASE_URL = 'https://api.search.brave.com/res/v1'
const BRAVE_DEFAULT_PER_KEY_LIMIT = 2000 // free-tier monthly cap

// Brave free tier hard-caps at 1 query/sec. The Base paid tier raises this,
// but enforcing 1/sec by default protects the free key from bouncing.
const MIN_REQUEST_INTERVAL_MS = 1000

const BACKOFF_DELAYS_MS = [1000, 2000, 4000, 8000]

// Brave pools share the brave_api_usage table. We partition them by key_index:
// search keys occupy 0..N-1, answer keys occupy ANSWER_POOL_OFFSET..+M-1.
// Keeping a single table avoids a migration; offset is high enough to never
// collide with realistic search-key counts (Brave plans cap at ~10 keys).
export const ANSWER_POOL_OFFSET = 1000

export type BravePool = 'search' | 'answer'

function readKeysFromEnvs(names: string[]): string[] {
  for (const name of names) {
    const raw = (process.env[name] || '').trim()
    if (raw.length === 0) continue
    const list = raw
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
    if (list.length > 0) return list
  }
  return []
}

function getLegacyKeys(): string[] {
  return readKeysFromEnvs(['BRAVE_API_KEYS', 'BRAVE_API_KEY'])
}

export function getKeysForPool(pool: BravePool): string[] {
  const direct =
    pool === 'answer'
      ? readKeysFromEnvs(['BRAVE_ANSWER_API_KEY', 'BRAVE_ANSWER_API_KEYS'])
      : readKeysFromEnvs(['BRAVE_SEARCH_API_KEY', 'BRAVE_SEARCH_API_KEYS'])
  if (direct.length > 0) return direct
  // Legacy fallback — same key serves both Search and Summarizer.
  return getLegacyKeys()
}

function poolForPath(path: string): BravePool {
  return path.startsWith('summarizer') ? 'answer' : 'search'
}

function dbKeyIndex(pool: BravePool, idxInPool: number): number {
  return pool === 'answer' ? idxInPool + ANSWER_POOL_OFFSET : idxInPool
}

// Per-key monthly limits aligned by index to the pool's key list.
//   BRAVE_SEARCH_MONTHLY_LIMIT=2000        → every search key gets 2000
//   BRAVE_SEARCH_MONTHLY_LIMIT=2000,10000  → key0=2000 (free), key1=10000 (paid)
// Legacy BRAVE_MONTHLY_LIMIT still works as fallback when the pool-specific
// override is unset (applies to both pools).
export function getPerKeyLimitsForPool(pool: BravePool, keyCount: number): number[] {
  if (keyCount <= 0) return []
  const envName = pool === 'answer' ? 'BRAVE_ANSWER_MONTHLY_LIMIT' : 'BRAVE_SEARCH_MONTHLY_LIMIT'
  const raw = (process.env[envName] || process.env['BRAVE_MONTHLY_LIMIT'] || '').trim()
  const tokens = raw.length > 0 ? raw.split(',') : []
  const parsed = tokens.map((t) => {
    const n = parseInt(t.trim(), 10)
    return Number.isFinite(n) && n > 0 ? n : null
  })

  const limits: number[] = []
  let carried = BRAVE_DEFAULT_PER_KEY_LIMIT
  for (let i = 0; i < keyCount; i++) {
    const v = i < parsed.length ? parsed[i] : null
    if (v != null) carried = v
    limits.push(carried)
  }
  return limits
}

// Backward-compat shim — preserves the original single-pool signature used
// by tests and legacy callers; resolves against the search pool's limits.
export function getPerKeyLimits(keyCount: number): number[] {
  return getPerKeyLimitsForPool('search', keyCount)
}

function currentMonth(): string {
  const d = new Date()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${d.getUTCFullYear()}-${m}`
}

export function isBraveSearchAvailable(): boolean {
  return getKeysForPool('search').length > 0
}

export function isBraveAnswerAvailable(): boolean {
  return getKeysForPool('answer').length > 0
}

// brave_api_usage table created by 20260520040000_add_brave_api_usage.sql.
// Cast at the boundary.
/* eslint-disable @typescript-eslint/no-explicit-any */

async function readUsage(): Promise<Map<number, number>> {
  const db = createServerClient() as any
  const out = new Map<number, number>()
  if (!db) return out
  const { data } = await db
    .from('brave_api_usage')
    .select('key_index, count')
    .eq('month', currentMonth())
  for (const row of (data || []) as Array<{ key_index: number; count: number }>) {
    out.set(row.key_index, row.count)
  }
  return out
}

async function incrementUsage(keyIndex: number): Promise<number> {
  const db = createServerClient() as any
  if (!db) return 0
  const { data, error } = await db.rpc('increment_brave_api_usage', {
    p_month: currentMonth(),
    p_key_index: keyIndex,
  })
  if (error) {
    logger.warn('Brave usage increment failed', { error: String(error) })
    return 0
  }
  return typeof data === 'number' ? data : 0
}

export interface BravePoolQuota {
  /** Whether this pool has at least one configured key. */
  configured: boolean
  limit: number
  used: number
  remaining: number
  perKey: Array<{ index: number; used: number; remaining: number }>
}

function poolQuotaFrom(pool: BravePool, usage: Map<number, number>): BravePoolQuota {
  const keys = getKeysForPool(pool)
  if (keys.length === 0) return { configured: false, limit: 0, used: 0, remaining: 0, perKey: [] }
  const limits = getPerKeyLimitsForPool(pool, keys.length)
  const perKey = keys.map((_, i) => {
    const used = usage.get(dbKeyIndex(pool, i)) || 0
    const keyLimit = limits[i] ?? BRAVE_DEFAULT_PER_KEY_LIMIT
    return { index: i, used, remaining: Math.max(0, keyLimit - used) }
  })
  const limit = limits.reduce((a, b) => a + b, 0)
  const used = perKey.reduce((a, k) => a + k.used, 0)
  return { configured: true, limit, used, remaining: Math.max(0, limit - used), perKey }
}

export async function getBraveQuota(): Promise<{
  // Aggregate across both pools — preserves the legacy shape so the
  // SERP spending widget keeps working without per-pool awareness.
  limit: number
  used: number
  remaining: number
  perKey: Array<{ index: number; used: number; remaining: number }>
  // Per-pool detail for the new dashboard breakdown.
  search: BravePoolQuota
  answer: BravePoolQuota
}> {
  const usage = await readUsage()
  const search = poolQuotaFrom('search', usage)
  const answer = poolQuotaFrom('answer', usage)
  const limit = search.limit + answer.limit
  const used = search.used + answer.used
  // Flatten perKey for legacy consumers; offset the answer pool's indices so
  // they don't collide with search keys in UIs that render the array directly.
  const perKey = [
    ...search.perKey,
    ...answer.perKey.map((k) => ({ ...k, index: k.index + ANSWER_POOL_OFFSET })),
  ]
  return { limit, used, remaining: Math.max(0, limit - used), perKey, search, answer }
}

export class BraveQuotaExceeded extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'BraveQuotaExceeded'
  }
}

// Minimal 1-req/sec rate limiter — Brave free's hard cap. Process-local
// (module-scope). For multi-instance (Vercel serverless cold starts), we
// rely on the backoff-on-429 path to recover; Upstash Redis would be the
// upgrade when we cross to multi-instance prod.
let lastRequestAt = 0

async function throttle(): Promise<void> {
  const now = Date.now()
  const wait = MIN_REQUEST_INTERVAL_MS - (now - lastRequestAt)
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait))
  }
  lastRequestAt = Date.now()
}

// Pool-scoped rotation cursors. Both pools share the 1-req/sec throttle.
const poolKeyCursor: Record<BravePool, number> = { search: 0, answer: 0 }

interface BraveCallOptions {
  /** Brave API path under /res/v1 (e.g. 'web/search', 'summarizer/search'). */
  path: string
  /** Query parameters. q / count / country / search_lang / etc. */
  params: Record<string, string>
}

/**
 * Low-level Brave API call. Handles auth, rate limit, backoff, quota tracking,
 * key rotation. Caller maps the JSON response to its own typed shape.
 *
 * Routing: paths under `summarizer/` hit the Answer-pool keys; everything
 * else hits the Search-pool keys.
 */
export async function callBrave({ path, params }: BraveCallOptions): Promise<unknown> {
  const pool = poolForPath(path)
  const keys = getKeysForPool(pool)
  if (keys.length === 0) {
    const envHint =
      pool === 'answer'
        ? 'BRAVE_ANSWER_API_KEY (or legacy BRAVE_API_KEYS)'
        : 'BRAVE_SEARCH_API_KEY (or legacy BRAVE_API_KEYS)'
    throw new Error(`${envHint} not configured for ${pool} pool`)
  }

  const limits = getPerKeyLimitsForPool(pool, keys.length)
  const usage = await readUsage()

  let lastErr: Error | null = null
  let allExhausted = true

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idxInPool = (poolKeyCursor[pool] + attempt) % keys.length
    const dbIdx = dbKeyIndex(pool, idxInPool)
    const keyLimit = limits[idxInPool] ?? BRAVE_DEFAULT_PER_KEY_LIMIT
    const already = usage.get(dbIdx) || 0
    if (already >= keyLimit) {
      lastErr = new Error(
        `Brave ${pool} key #${idxInPool + 1} monthly quota exhausted (${already}/${keyLimit})`,
      )
      continue
    }
    allExhausted = false

    const key = keys[idxInPool]!
    const url = new URL(`${BRAVE_BASE_URL}/${path}`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

    // Per-attempt backoff loop for transient errors on THIS key.
    for (let backoffAttempt = 0; backoffAttempt < BACKOFF_DELAYS_MS.length; backoffAttempt++) {
      await throttle()
      try {
        const res = await fetch(url.toString(), {
          headers: {
            Accept: 'application/json',
            'X-Subscription-Token': key,
          },
          signal: AbortSignal.timeout(25_000),
        })

        if (res.status === 429) {
          const base = BACKOFF_DELAYS_MS[backoffAttempt] ?? 8000
          const jitter = base * (0.75 + Math.random() * 0.5)
          logger.warn(`Brave 429 — backing off ${Math.round(jitter)}ms`, {
            service: 'brave-search',
            pool,
            attempt: backoffAttempt + 1,
            keyIndex: idxInPool,
          })
          await new Promise((r) => setTimeout(r, jitter))
          continue
        }

        if (res.status === 401 || res.status === 403) {
          await incrementUsage(dbIdx)
          usage.set(dbIdx, (usage.get(dbIdx) || 0) + 1)
          lastErr = new Error(
            `Brave ${pool} key #${idxInPool + 1} unauthorized/forbidden (${res.status})`,
          )
          break
        }

        if (res.status >= 500) {
          const base = BACKOFF_DELAYS_MS[backoffAttempt] ?? 8000
          await new Promise((r) => setTimeout(r, base))
          lastErr = new Error(`Brave HTTP ${res.status}`)
          continue
        }

        if (!res.ok) {
          const body = await res.text().catch(() => '')
          throw new Error(`Brave HTTP ${res.status}: ${body.slice(0, 200)}`)
        }

        const json = (await res.json()) as unknown
        const newCount = await incrementUsage(dbIdx)
        if (newCount >= keyLimit) {
          logger.warn(`Brave ${pool} key #${idxInPool + 1} reached monthly limit`, {
            service: 'brave-search',
            pool,
            used: newCount,
            limit: keyLimit,
          })
        }
        poolKeyCursor[pool] = (idxInPool + 1) % keys.length
        return json
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e))
      }
    }
  }

  if (allExhausted) {
    throw new BraveQuotaExceeded(
      `All ${keys.length} Brave ${pool} keys reached their monthly limits (${limits.join('/')} queries).`,
    )
  }
  throw lastErr ?? new Error(`All Brave ${pool} keys failed`)
}

// ─── High-level helpers ──────────────────────────────────────────────────────

function localeParams(lang?: string): Record<string, string> {
  if (lang === 'it') return { country: 'IT', search_lang: 'it', ui_lang: 'it-IT' }
  if (lang === 'sv') return { country: 'SE', search_lang: 'sv', ui_lang: 'sv-SE' }
  return { country: 'US', search_lang: 'en', ui_lang: 'en-US' }
}

export interface BravePAAQuestion {
  question: string
  snippet: string | null
  sourceUrl: string | null
  sourceTitle: string | null
}

interface BraveWebSearchResponse {
  faq?: {
    results?: Array<{
      question?: string
      answer?: string
      title?: string
      url?: string
    }>
  }
  discussions?: {
    results?: Array<{
      title?: string
      description?: string
      url?: string
    }>
  }
  web?: {
    results?: Array<{ title?: string; url?: string; description?: string }>
  }
}

/**
 * "People Also Ask"-style question extraction for the AEO Snippets generator.
 * Brave's web search returns a `faq` component for query patterns that have
 * People-Also-Ask data on Google (Brave aggregates similar signals). When
 * that's missing, fall back to `discussions` (forum-thread titles often phrase
 * a question).
 */
export async function fetchPAAQuestions(
  keyword: string,
  language?: string,
  max = 10,
): Promise<BravePAAQuestion[]> {
  const json = (await callBrave({
    path: 'web/search',
    params: {
      q: keyword,
      count: '10',
      ...localeParams(language),
    },
  })) as BraveWebSearchResponse

  const out: BravePAAQuestion[] = []

  // Preferred: explicit FAQ component.
  for (const f of json.faq?.results || []) {
    if (out.length >= max) break
    const q = (f.question || '').trim()
    if (q.length === 0) continue
    out.push({
      question: q,
      snippet: f.answer ?? null,
      sourceUrl: f.url ?? null,
      sourceTitle: f.title ?? null,
    })
  }

  // Fallback: forum discussion titles that look like questions.
  if (out.length === 0) {
    for (const d of json.discussions?.results || []) {
      if (out.length >= max) break
      const title = (d.title || '').trim()
      if (title.length === 0 || !title.includes('?')) continue
      out.push({
        question: title,
        snippet: d.description ?? null,
        sourceUrl: d.url ?? null,
        sourceTitle: null,
      })
    }
  }

  return out
}

export interface BraveGapCheckResult {
  covered: boolean
  coveredUrl: string | null
  position: number | null
}

/**
 * "Does this brand's domain rank for the question?" — used by AEO Snippets'
 * gap detection. `site:` search on Brave returns up to N web results from
 * that domain; first match = covered.
 */
export async function checkDomainRanksForQuestion(
  domain: string,
  question: string,
  language?: string,
): Promise<BraveGapCheckResult> {
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')

  const locale = localeParams(language)
  const q = `site:${cleanDomain} ${question}`
  const json = (await withSerpCache(
    {
      provider: 'brave',
      endpoint: 'web/search',
      params: { q, count: 5, ...locale },
    },
    () =>
      callBrave({
        path: 'web/search',
        params: { q, count: '5', ...locale },
      }),
  )) as BraveWebSearchResponse

  const first = (json.web?.results || [])[0]
  if (!first?.url) return { covered: false, coveredUrl: null, position: null }
  return { covered: true, coveredUrl: first.url, position: 1 }
}

// ─── Generic SERP ranking (Brave index — citation tracking, NOT Google rank) ─

export interface BraveOrganicResult {
  title: string
  url: string
  rank: number
  description?: string
}

export interface BraveRankingResult {
  /** First position the brandDomain appears at in Brave's organic results, or 0 if absent. */
  position: number
  /** First matching URL, or null. */
  url: string | null
  /** Top 10 organic results (always returned, useful for UI / context). */
  organicResults: BraveOrganicResult[]
}

/**
 * Track where a brand domain appears in Brave's organic results for a given
 * query. This is the citation-tracking equivalent of Google rank tracking —
 * per the v2 API strategy ("Google rank tracking" → "AI engine citation
 * tracking"). For real Google AI Overview detection use DataForSEO instead.
 */
export async function searchBrandRanking(
  keyword: string,
  brandDomain: string,
  language?: string,
): Promise<BraveRankingResult> {
  // Cache key does NOT include brandDomain — the SERP response is the same
  // regardless of which brand we're checking; brand matching happens in
  // post-processing. This is the win: 10 brands tracking the same keyword
  // share a single Brave hit.
  const locale = localeParams(language)
  const json = (await withSerpCache(
    {
      provider: 'brave',
      endpoint: 'web/search',
      params: { q: keyword, count: 20, ...locale },
    },
    () =>
      callBrave({
        path: 'web/search',
        params: { q: keyword, count: '20', ...locale },
      }),
  )) as BraveWebSearchResponse

  const cleanDomain = brandDomain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')

  const results = (json.web?.results || []).slice(0, 20).map((r, i) => ({
    title: r.title || '',
    url: r.url || '',
    rank: i + 1,
    description: r.description,
  }))

  let position = 0
  let url: string | null = null
  if (cleanDomain) {
    for (const r of results) {
      if (r.url.includes(cleanDomain)) {
        position = r.rank
        url = r.url
        break
      }
    }
  }

  return {
    position,
    url,
    organicResults: results.slice(0, 10),
  }
}

/**
 * Generic top web results for a query — the organic pages an AI engine would
 * draw on. Used by citation-grounding to give real source URLs to engines that
 * don't natively cite (ChatGPT, Claude). Shares the SERP cache, so grounding
 * the same prompt across engines/brands costs a single Brave hit.
 */
export async function fetchWebResults(
  query: string,
  language?: string,
  count = 10,
): Promise<BraveOrganicResult[]> {
  const locale = localeParams(language)
  const json = (await withSerpCache(
    {
      provider: 'brave',
      endpoint: 'web/search',
      params: { q: query, count, ...locale },
    },
    () =>
      callBrave({
        path: 'web/search',
        params: { q: query, count: String(count), ...locale },
      }),
  )) as BraveWebSearchResponse

  return (json.web?.results || []).slice(0, count).map((r, i) => ({
    title: r.title || '',
    url: r.url || '',
    rank: i + 1,
    description: r.description,
  }))
}

// ─── Summarizer (AI Overview substitute) ─────────────────────────────────────

export interface BraveSummary {
  answer: string
  citations: Array<{ title: string; url: string }>
}

interface BraveSummarizerResponse {
  summary?: { text?: string }
  citations?: Array<{ title?: string; url?: string }>
}

/**
 * Brave Summarizer API — returns a generated answer + citation URLs for a
 * query. This is the "honest substitute" for Google AI Overview detection
 * documented in the API strategy memo. Use sparingly; counts against the
 * same monthly quota.
 */
export async function summarizeQuery(
  query: string,
  language?: string,
): Promise<BraveSummary | null> {
  if (!isBraveAnswerAvailable()) {
    logger.debug('Brave Summarizer skipped — answer pool not configured', {
      service: 'brave-search',
    })
    return null
  }
  const locale = localeParams(language)
  const json = (await withSerpCache(
    {
      provider: 'brave',
      endpoint: 'summarizer/search',
      params: { q: query, ...locale },
    },
    () =>
      callBrave({
        path: 'summarizer/search',
        params: { q: query, ...locale },
      }),
  )) as BraveSummarizerResponse

  const answer = json.summary?.text?.trim()
  if (!answer) return null
  const citations = (json.citations || [])
    .filter((c): c is { title: string; url: string } => !!c.title && !!c.url)
    .map((c) => ({ title: c.title, url: c.url }))
  return { answer, citations }
}
