// PATH: src/lib/services/serp-cache.ts
//
// SERP query response cache + in-memory promise coalescing.
//
// Two layers, both keyed on a deterministic hash of {provider, endpoint, params}:
//
//   1) In-memory promise map (per-process, lives in this module). If two
//      concurrent calls fire the same query within the same Node process,
//      the second awaits the first's promise — zero duplicate provider calls.
//      Survives only as long as the request lifecycle; in serverless this is
//      tens of seconds at most.
//
//   2) Postgres TTL cache (serp_query_cache table). Persists across processes
//      and across deploys. Default TTLs per endpoint encode how often the
//      underlying SERP actually changes — see DEFAULT_TTL_SECONDS below.
//
// Usage:
//
//   const result = await withSerpCache({
//     provider: 'brave',
//     endpoint: 'web/search',
//     params: { q: keyword, country: 'SE' },
//   }, () => callBrave({ path: 'web/search', params: ... }))
//
// On hit (memory OR db), the callback is NEVER invoked. On miss, the callback
// runs once, the result is stored to db, and concurrent waiters all receive
// the same value.

import { createHash } from 'crypto'
import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/* eslint-disable @typescript-eslint/no-explicit-any */
// serp_query_cache not yet in generated Database type; cast at boundary.

export type SerpCacheProvider = 'brave' | 'dataforseo'

export type SerpCacheEndpoint =
  // Brave
  | 'web/search'
  | 'summarizer/search'
  // DataForSEO (narrow scope: PAA, AI Overview, Knowledge Graph, keyword volume)
  | 'paa'
  | 'ai-overview'
  | 'knowledge-graph'
  | 'keyword-volume'

export interface SerpCacheKey {
  provider: SerpCacheProvider
  endpoint: SerpCacheEndpoint
  params: Record<string, unknown>
}

/**
 * TTL defaults per endpoint. Tuned to the actual update cadence of each
 * SERP surface — over-caching gives stale data, under-caching wastes quota.
 *
 *   - web/search (organic):        4h  — Google/Brave organic positions
 *                                       fluctuate hourly but day-to-day
 *                                       shifts dominate for our use case
 *                                       (citation tracking).
 *   - summarizer/search:           24h — Brave's AI summary is mostly stable
 *                                       across a day; we don't poll often.
 *   - paa (Google PAA via DFS):    24h — PAA box rotation is slow (~days).
 *   - ai-overview (DFS):           6h  — AIO is volatile but a 6h cache
 *                                       still cuts >50% of duplicate cost.
 *   - knowledge-graph (DFS):       7d  — entity KG cards change very rarely.
 *   - keyword-volume (DFS):        30d — search volume buckets shift monthly.
 */
const DEFAULT_TTL_SECONDS: Record<SerpCacheEndpoint, number> = {
  'web/search': 4 * 3600,
  'summarizer/search': 24 * 3600,
  paa: 24 * 3600,
  'ai-overview': 6 * 3600,
  'knowledge-graph': 7 * 24 * 3600,
  'keyword-volume': 30 * 24 * 3600,
}

function normalize(params: Record<string, unknown>): string {
  // Stable JSON: sort keys so {a:1,b:2} and {b:2,a:1} produce the same hash.
  const keys = Object.keys(params).sort()
  const ordered: Record<string, unknown> = {}
  for (const k of keys) ordered[k] = params[k]
  return JSON.stringify(ordered)
}

function hashKey(key: SerpCacheKey): string {
  const normalized = `${key.provider}::${key.endpoint}::${normalize(key.params)}`
  return createHash('sha256').update(normalized).digest('hex')
}

/** In-memory promise map for request coalescing within a single process. */
const inflight = new Map<string, Promise<unknown>>()

interface CacheReadResult<T> {
  hit: boolean
  value: T | null
}

async function readCache<T>(
  provider: SerpCacheProvider,
  endpoint: SerpCacheEndpoint,
  queryHash: string,
): Promise<CacheReadResult<T>> {
  const db = createServerClient() as any
  if (!db) return { hit: false, value: null }
  try {
    const { data } = await db
      .from('serp_query_cache')
      .select('response, expires_at')
      .eq('provider', provider)
      .eq('endpoint', endpoint)
      .eq('query_hash', queryHash)
      .maybeSingle()

    if (!data) return { hit: false, value: null }
    const expiresAt = new Date(data.expires_at as string)
    if (expiresAt.getTime() <= Date.now()) {
      // Expired — treat as miss; the upsert in writeCache will overwrite.
      return { hit: false, value: null }
    }
    // Best-effort hit_count bump (fire-and-forget).
    db.rpc('serp_cache_register_hit', {
      p_provider: provider,
      p_endpoint: endpoint,
      p_query_hash: queryHash,
    }).then(undefined, () => {})
    return { hit: true, value: data.response as T }
  } catch (err) {
    logger.warn('serp-cache read failed', {
      service: 'serp-cache',
      provider,
      endpoint,
      err: String(err),
    })
    return { hit: false, value: null }
  }
}

async function writeCache<T>(
  provider: SerpCacheProvider,
  endpoint: SerpCacheEndpoint,
  queryHash: string,
  params: Record<string, unknown>,
  response: T,
  ttlSeconds: number,
): Promise<void> {
  const db = createServerClient() as any
  if (!db) return
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
  try {
    await db.from('serp_query_cache').upsert(
      {
        provider,
        endpoint,
        query_hash: queryHash,
        params,
        response,
        expires_at: expiresAt,
        // hit_count intentionally not set — defaults to 0 on insert, untouched on upsert.
      },
      { onConflict: 'provider,endpoint,query_hash' },
    )
  } catch (err) {
    logger.warn('serp-cache write failed', {
      service: 'serp-cache',
      provider,
      endpoint,
      err: String(err),
    })
  }
}

/**
 * Cache-or-fetch with in-memory dedup. The `call` callback is invoked at
 * most once per (provider, endpoint, normalized-params) tuple per TTL window
 * AND at most once concurrently per process.
 *
 * `ttlSeconds` — override the per-endpoint default. Pass 0 to bypass the
 *   db cache entirely (memory dedup still applies). Pass a negative number
 *   to also bypass memory dedup (escape hatch for forced refresh).
 *
 * `options.shouldCache` — predicate gating the db write. Defaults to "always
 *   cache". Use it to AVOID persisting empty/negative results: e.g. an empty
 *   PAA array is usually a transient miss (DFS hiccup, rate limit) and caching
 *   it for 24h would poison every retry. Memory dedup still applies regardless.
 */
export async function withSerpCache<T>(
  key: SerpCacheKey,
  call: () => Promise<T>,
  ttlSeconds?: number,
  options?: { shouldCache?: (result: T) => boolean },
): Promise<T> {
  const ttl = ttlSeconds ?? DEFAULT_TTL_SECONDS[key.endpoint]

  // Negative TTL = force refresh, skip every layer.
  if (ttl < 0) return call()

  const queryHash = hashKey(key)
  const memoryKey = `${key.provider}::${key.endpoint}::${queryHash}`

  // Layer 1: in-memory promise coalescing. The lookup AND the registration
  // must both happen synchronously at call entry — otherwise concurrent
  // callers race past the `await readCache` microtask before any of them
  // installs the inflight entry, defeating dedup.
  const pending = inflight.get(memoryKey)
  if (pending) return pending as Promise<T>

  const p = (async () => {
    try {
      // Layer 2: db cache. Checked inside the inflight promise so concurrent
      // callers share the same db lookup too.
      if (ttl > 0) {
        const cached = await readCache<T>(key.provider, key.endpoint, queryHash)
        if (cached.hit && cached.value !== null) return cached.value
      }

      const result = await call()
      const shouldCache = options?.shouldCache ? options.shouldCache(result) : true
      if (ttl > 0 && shouldCache) {
        await writeCache(key.provider, key.endpoint, queryHash, key.params, result, ttl)
      }
      return result
    } finally {
      inflight.delete(memoryKey)
    }
  })()

  inflight.set(memoryKey, p)
  return p
}

/** Stats reader for the operator dashboard / debugging. */
export async function getSerpCacheStats(): Promise<{
  totalRows: number
  totalHits: number
  topReused: Array<{ provider: string; endpoint: string; hit_count: number }>
}> {
  const db = createServerClient() as any
  if (!db) return { totalRows: 0, totalHits: 0, topReused: [] }
  try {
    const [{ count: totalRows }, { data: hits }, { data: top }] = await Promise.all([
      db.from('serp_query_cache').select('*', { count: 'exact', head: true }),
      db.from('serp_query_cache').select('hit_count'),
      db
        .from('serp_query_cache')
        .select('provider, endpoint, hit_count')
        .order('hit_count', { ascending: false })
        .limit(10),
    ])
    const totalHits =
      (hits as Array<{ hit_count: number }> | null)?.reduce((a, r) => a + (r.hit_count || 0), 0) ??
      0
    return {
      totalRows: totalRows ?? 0,
      totalHits,
      topReused: (top as Array<{ provider: string; endpoint: string; hit_count: number }>) || [],
    }
  } catch (err) {
    logger.warn('serp-cache stats failed', { service: 'serp-cache', err: String(err) })
    return { totalRows: 0, totalHits: 0, topReused: [] }
  }
}
