// PATH: src/lib/services/search-index.ts
//
// Meilisearch integration for the internal platform search (brands/prompts),
// per docs/research/tooling-repos-2026-08.md — replaces the ILIKE-only query
// in /api/search with typo-tolerant, ranked, multi-tenant search.
//
// Design rules:
//   - OPT-IN: the endpoint keeps working unchanged until MEILISEARCH_HOST +
//     MEILISEARCH_API_KEY are configured. `searchInternal()` returns `null`
//     whenever Meilisearch is not configured or any call fails, and the route
//     falls back to the existing PostgREST ILIKE path. No new REQUIRED env var,
//     no crash, no data loss.
//   - MULTI-TENANT: every query is scoped with a Meilisearch `filter` on
//     `brand_id IN [accessibleBrandIds]`, mirroring the access check the ILIKE
//     path already applies via getAccessibleBrandIds.
//   - Direct REST calls (POST /indexes/{uid}/search) — no SDK dependency; the
//     endpoint shape is stable and this keeps the dependency surface flat.
//
// Index contract (one unified index, uid = "search"):
//   documents: { id, type: "brand"|"prompt", name, brand_id }
//     - brand row  → { id: brand.id, type: "brand", name: brand.name, brand_id: brand.id }
//     - prompt row → { id: prompt.id, type: "prompt", name: prompt.text, brand_id: prompt.brand_id }
//   filterableAttributes: ["brand_id"]
// Population happens out-of-band (a seed job / write hook); the search side
// degrades to ILIKE until the index is populated (empty hits → fallback).

import { safeFetch } from '@/lib/utils/safe-fetch'
import { logger } from '@/lib/logger'

export interface SearchHit {
  type: 'brand' | 'prompt'
  id: string
  name: string
}

export interface SearchIndexResult {
  hits: SearchHit[]
  /** True when the query was served by Meilisearch. */
  servedByIndex: boolean
}

function host(): string {
  return (process.env['MEILISEARCH_HOST'] || '').trim().replace(/\/+$/, '')
}

function apiKey(): string {
  return (process.env['MEILISEARCH_API_KEY'] || '').trim()
}

/** Whether the Meilisearch integration is configured. */
export function isMeilisearchConfigured(): boolean {
  return host().length > 0 && apiKey().length > 0
}

interface MeilisearchHit {
  id: string
  type?: 'brand' | 'prompt'
  name?: string
  brand_id?: string
}

interface MeilisearchSearchResponse {
  hits?: MeilisearchHit[]
}

function brandFilter(accessibleBrandIds: string[]): string {
  // Meilisearch filter syntax: `brand_id IN ["a","b"]`. If the list is empty
  // no document can match — callers pass the route's access-checked list, and
  // an empty list yields a safe "match nothing" filter.
  const values = accessibleBrandIds.map((id) => JSON.stringify(id)).join(', ')
  return values.length > 0 ? `brand_id IN [${values}]` : `brand_id IN ["__none__"]`
}

/**
 * Search the internal index for the caller's accessible brands/prompts.
 * Returns `null` when Meilisearch is unconfigured or fails, so the caller
 * transparently falls back to the ILIKE path.
 */
export async function searchInternal(
  query: string,
  accessibleBrandIds: string[],
  opts: { limit?: number } = {},
): Promise<SearchIndexResult | null> {
  if (!isMeilisearchConfigured()) return null
  const q = query.trim()
  if (!q) return { hits: [], servedByIndex: true }

  const limit = Math.max(1, Math.min(opts.limit ?? 10, 50))

  try {
    const res = await safeFetch(`${host()}/indexes/search/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({
        q,
        filter: brandFilter(accessibleBrandIds),
        limit,
        attributesToRetrieve: ['id', 'type', 'name'],
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      logger.warn('Meilisearch search failed — falling back to ILIKE', {
        service: 'search-index',
        status: res.status,
      })
      return null
    }
    const data = (await res.json()) as MeilisearchSearchResponse
    const hits = (data.hits || [])
      .filter((h): h is MeilisearchHit => typeof h.id === 'string' && h.id.length > 0)
      .filter((h): h is SearchHit => h.type === 'brand' || h.type === 'prompt')
      .map((h) => ({ type: h.type, id: h.id, name: h.name || '' }))
    return { hits, servedByIndex: true }
  } catch (err) {
    logger.warn('Meilisearch search errored — falling back to ILIKE', {
      service: 'search-index',
      err: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}
