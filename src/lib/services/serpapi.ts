// PATH: src/lib/services/serpapi.ts
// SerpAPI wrapper with key rotation + persistent monthly quota enforcement.
// Exposes the low-level fetch plus PAA and site-search helpers used by the
// AEO snippet generator.

import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

function getKeys(): string[] {
  const raw = process.env.SERPAPI_KEYS || process.env.SERPAPI_KEY || ''
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
}

function getPerKeyLimit(): number {
  const raw = process.env.SERPAPI_MONTHLY_LIMIT
  const parsed = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100
}

function currentMonth(): string {
  const d = new Date()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${d.getUTCFullYear()}-${m}`
}

export function isSerpApiAvailable(): boolean {
  return getKeys().length > 0
}

// Note: serpapi_usage + aeo_* tables and the increment_serpapi_usage RPC exist
// in DB but aren't in the generated Database types yet, so we cast to any at the
// boundary (matches the pattern used by workspace-auth.ts).
/* eslint-disable @typescript-eslint/no-explicit-any */

async function readUsage(): Promise<Map<number, number>> {
  // serpapi_usage table not yet in Database type
  const db = createServerClient() as any
  const out = new Map<number, number>()
  if (!db) return out
  const { data } = await db
    .from('serpapi_usage')
    .select('key_index, count')
    .eq('month', currentMonth())
  for (const row of (data || []) as Array<{ key_index: number; count: number }>) {
    out.set(row.key_index, row.count)
  }
  return out
}

async function incrementUsage(keyIndex: number): Promise<number> {
  // serpapi_usage table + increment_serpapi_usage RPC not in Database type
  const db = createServerClient() as any
  if (!db) return 0
  const { data, error } = await db.rpc('increment_serpapi_usage', {
    p_month: currentMonth(),
    p_key_index: keyIndex,
  })
  if (error) {
    logger.warn('SerpAPI usage increment failed', { error: String(error) })
    return 0
  }
  return typeof data === 'number' ? data : 0
}

export async function getSerpApiQuota(): Promise<{
  limit: number
  used: number
  remaining: number
  perKey: Array<{ index: number; used: number; remaining: number }>
}> {
  const keys = getKeys()
  const limit = getPerKeyLimit() * keys.length
  if (keys.length === 0) return { limit: 0, used: 0, remaining: 0, perKey: [] }
  const usage = await readUsage()
  const perKey = keys.map((_, i) => {
    const used = usage.get(i) || 0
    return { index: i, used, remaining: Math.max(0, getPerKeyLimit() - used) }
  })
  const used = perKey.reduce((a, k) => a + k.used, 0)
  return { limit, used, remaining: Math.max(0, limit - used), perKey }
}

export class SerpApiQuotaExceeded extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'SerpApiQuotaExceeded'
  }
}

let keyIndex = 0

export async function serpApiFetch(params: Record<string, string>): Promise<unknown> {
  const keys = getKeys()
  if (keys.length === 0) throw new Error('SERPAPI_KEYS not configured')

  const limit = getPerKeyLimit()
  const usage = await readUsage()

  let lastErr: Error | null = null
  let allExhausted = true

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (keyIndex + attempt) % keys.length
    const already = usage.get(idx) || 0
    if (already >= limit) {
      lastErr = new Error(`SerpAPI key #${idx + 1} monthly quota exhausted (${already}/${limit})`)
      continue
    }
    allExhausted = false

    const key = keys[idx]!
    const url = new URL('https://serpapi.com/search.json')
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    url.searchParams.set('api_key', key)

    try {
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(25_000) })

      if (res.status === 429 || res.status === 401) {
        await incrementUsage(idx)
        usage.set(idx, (usage.get(idx) || 0) + 1)
        lastErr = new Error(`SerpAPI key #${idx + 1} rate-limited/invalid`)
        continue
      }
      if (!res.ok) {
        lastErr = new Error(`SerpAPI HTTP ${res.status}`)
        continue
      }

      const json = await res.json()
      if (json?.error && typeof json.error === 'string') {
        if (/run out|exceeded|hourly|searches per|plan/i.test(json.error)) {
          await incrementUsage(idx)
          usage.set(idx, (usage.get(idx) || 0) + 1)
          lastErr = new Error(`SerpAPI key #${idx + 1}: ${json.error}`)
          continue
        }
      }

      const newCount = await incrementUsage(idx)
      if (newCount >= limit) {
        logger.warn(`SerpAPI key #${idx + 1} reached monthly limit`, {
          service: 'serpapi',
          used: newCount,
          limit,
        })
      }
      keyIndex = (idx + 1) % keys.length
      return json
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      continue
    }
  }

  if (allExhausted) {
    throw new SerpApiQuotaExceeded(
      `All ${keys.length} SerpAPI keys reached their monthly limit of ${limit} searches.`,
    )
  }

  throw lastErr ?? new Error('All SerpAPI keys failed')
}

function localeParams(lang?: string): Record<string, string> {
  if (lang === 'it') return { hl: 'it', gl: 'it' }
  if (lang === 'sv') return { hl: 'sv', gl: 'se' }
  return { hl: 'en', gl: 'us' }
}

// ─── People Also Ask (PAA) ───────────────────────────────────────────────────
// Returns the list of PAA questions + snippet + source link for a keyword.

export interface PAAQuestion {
  question: string
  snippet: string | null
  sourceUrl: string | null
  sourceTitle: string | null
}

interface SerpRelatedQuestion {
  question?: string
  snippet?: string
  title?: string
  link?: string
  displayed_link?: string
}

interface SerpGoogleResponse {
  related_questions?: SerpRelatedQuestion[]
  organic_results?: Array<{ link?: string; title?: string; snippet?: string }>
}

export async function fetchPAAQuestions(
  keyword: string,
  language?: string,
  max = 10,
): Promise<PAAQuestion[]> {
  const json = (await serpApiFetch({
    engine: 'google',
    q: keyword,
    num: '10',
    ...localeParams(language),
  })) as SerpGoogleResponse

  const paa = json.related_questions || []
  return paa
    .slice(0, max)
    .map((q) => ({
      question: (q.question || '').trim(),
      snippet: q.snippet ?? null,
      sourceUrl: q.link ?? null,
      sourceTitle: q.title ?? null,
    }))
    .filter((q) => q.question.length > 0)
}

// ─── Gap detection: does a brand domain rank for a given question? ──────────

export interface GapCheckResult {
  covered: boolean
  coveredUrl: string | null
  position: number | null
}

export async function checkDomainRanksForQuestion(
  domain: string,
  question: string,
  language?: string,
): Promise<GapCheckResult> {
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
  const json = (await serpApiFetch({
    engine: 'google',
    q: `site:${cleanDomain} ${question}`,
    num: '5',
    ...localeParams(language),
  })) as SerpGoogleResponse

  const first = (json.organic_results || [])[0]
  if (!first?.link) return { covered: false, coveredUrl: null, position: null }
  return { covered: true, coveredUrl: first.link, position: 1 }
}
