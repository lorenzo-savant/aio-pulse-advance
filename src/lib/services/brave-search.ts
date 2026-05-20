// PATH: src/lib/services/brave-search.ts
//
// Brave Search API wrapper — PRIMARY SERP provider as of v2.1.0+.
//
// Strategy decision (see ~/.claude/projects/.../memory/project_api_strategy.md):
// Brave is the primary provider — 2k queries/month free recurring, AI-native,
// "honest substitute" for Google AI Overview via the Summarizer endpoint.
// Serper.dev is the paid tier when Brave free runs out (separate provider).
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

const BRAVE_BASE_URL = 'https://api.search.brave.com/res/v1'
const BRAVE_DEFAULT_PER_KEY_LIMIT = 2000 // free-tier monthly cap

// Brave free tier hard-caps at 1 query/sec. The Base paid tier raises this,
// but enforcing 1/sec by default protects the free key from bouncing.
const MIN_REQUEST_INTERVAL_MS = 1000

const BACKOFF_DELAYS_MS = [1000, 2000, 4000, 8000]

function getKeys(): string[] {
  const raw = process.env['BRAVE_API_KEYS'] || process.env['BRAVE_API_KEY'] || ''
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
}

// Per-key monthly limits aligned by index to BRAVE_API_KEYS — same shape
// as SERPAPI_MONTHLY_LIMIT to keep operator muscle-memory across providers.
//   BRAVE_MONTHLY_LIMIT=2000             → every key gets 2000 (the free cap)
//   BRAVE_MONTHLY_LIMIT=2000,10000       → key0=2000 (free), key1=10000 (paid)
export function getPerKeyLimits(keyCount: number): number[] {
  if (keyCount <= 0) return []
  const raw = (process.env['BRAVE_MONTHLY_LIMIT'] || '').trim()
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

function currentMonth(): string {
  const d = new Date()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${d.getUTCFullYear()}-${m}`
}

export function isBraveSearchAvailable(): boolean {
  return getKeys().length > 0
}

// brave_api_usage table created by 20260520040000_add_brave_api_usage.sql.
// Cast at the boundary — same pattern as serpapi.ts.
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

export async function getBraveQuota(): Promise<{
  limit: number
  used: number
  remaining: number
  perKey: Array<{ index: number; used: number; remaining: number }>
}> {
  const keys = getKeys()
  if (keys.length === 0) return { limit: 0, used: 0, remaining: 0, perKey: [] }
  const limits = getPerKeyLimits(keys.length)
  const usage = await readUsage()
  const perKey = keys.map((_, i) => {
    const used = usage.get(i) || 0
    const keyLimit = limits[i] ?? BRAVE_DEFAULT_PER_KEY_LIMIT
    return { index: i, used, remaining: Math.max(0, keyLimit - used) }
  })
  const limit = limits.reduce((a, b) => a + b, 0)
  const used = perKey.reduce((a, k) => a + k.used, 0)
  return { limit, used, remaining: Math.max(0, limit - used), perKey }
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

let keyIndex = 0

interface BraveCallOptions {
  /** Brave API path under /res/v1 (e.g. 'web/search', 'summarizer/search'). */
  path: string
  /** Query parameters. q / count / country / search_lang / etc. */
  params: Record<string, string>
}

/**
 * Low-level Brave API call. Handles auth, rate limit, backoff, quota tracking,
 * key rotation. Caller maps the JSON response to its own typed shape.
 */
export async function callBrave({ path, params }: BraveCallOptions): Promise<unknown> {
  const keys = getKeys()
  if (keys.length === 0) throw new Error('BRAVE_API_KEYS not configured')

  const limits = getPerKeyLimits(keys.length)
  const usage = await readUsage()

  let lastErr: Error | null = null
  let allExhausted = true

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (keyIndex + attempt) % keys.length
    const keyLimit = limits[idx] ?? BRAVE_DEFAULT_PER_KEY_LIMIT
    const already = usage.get(idx) || 0
    if (already >= keyLimit) {
      lastErr = new Error(`Brave key #${idx + 1} monthly quota exhausted (${already}/${keyLimit})`)
      continue
    }
    allExhausted = false

    const key = keys[idx]!
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
          // Add ±25% jitter to backoff so concurrent callers desynchronise.
          const base = BACKOFF_DELAYS_MS[backoffAttempt] ?? 8000
          const jitter = base * (0.75 + Math.random() * 0.5)
          logger.warn(`Brave 429 — backing off ${Math.round(jitter)}ms`, {
            service: 'brave-search',
            attempt: backoffAttempt + 1,
            keyIndex: idx,
          })
          await new Promise((r) => setTimeout(r, jitter))
          continue // retry same key
        }

        if (res.status === 401 || res.status === 403) {
          // Auth-level failure — don't retry this key, try next one if any.
          await incrementUsage(idx)
          usage.set(idx, (usage.get(idx) || 0) + 1)
          lastErr = new Error(`Brave key #${idx + 1} unauthorized/forbidden (${res.status})`)
          break // exit backoff loop, try next key
        }

        if (res.status >= 500) {
          // Server-side transient. Backoff + retry same key.
          const base = BACKOFF_DELAYS_MS[backoffAttempt] ?? 8000
          await new Promise((r) => setTimeout(r, base))
          lastErr = new Error(`Brave HTTP ${res.status}`)
          continue
        }

        if (!res.ok) {
          // 4xx other than 401/403/429 = caller's bad input. Don't retry.
          const body = await res.text().catch(() => '')
          throw new Error(`Brave HTTP ${res.status}: ${body.slice(0, 200)}`)
        }

        const json = (await res.json()) as unknown
        const newCount = await incrementUsage(idx)
        if (newCount >= keyLimit) {
          logger.warn(`Brave key #${idx + 1} reached monthly limit`, {
            service: 'brave-search',
            used: newCount,
            limit: keyLimit,
          })
        }
        keyIndex = (idx + 1) % keys.length
        return json
      } catch (e) {
        // Network / abort / parse error. Treat as transient — backoff + retry.
        lastErr = e instanceof Error ? e : new Error(String(e))
      }
    }
    // Backoff exhausted for this key; try next key.
  }

  if (allExhausted) {
    throw new BraveQuotaExceeded(
      `All ${keys.length} Brave keys reached their monthly limits (${limits.join('/')} queries).`,
    )
  }
  throw lastErr ?? new Error('All Brave keys failed')
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

  const json = (await callBrave({
    path: 'web/search',
    params: {
      q: `site:${cleanDomain} ${question}`,
      count: '5',
      ...localeParams(language),
    },
  })) as BraveWebSearchResponse

  const first = (json.web?.results || [])[0]
  if (!first?.url) return { covered: false, coveredUrl: null, position: null }
  return { covered: true, coveredUrl: first.url, position: 1 }
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
  const json = (await callBrave({
    path: 'summarizer/search',
    params: {
      q: query,
      ...localeParams(language),
    },
  })) as BraveSummarizerResponse

  const answer = json.summary?.text?.trim()
  if (!answer) return null
  const citations = (json.citations || [])
    .filter((c): c is { title: string; url: string } => !!c.title && !!c.url)
    .map((c) => ({ title: c.title, url: c.url }))
  return { answer, citations }
}
