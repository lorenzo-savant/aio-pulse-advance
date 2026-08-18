// PATH: src/lib/services/reranker.ts
//
// Cross-source relevance reranker — the missing "reranker" stage of the
// LibreChat web_search pattern (provider → scraper → reranker) evaluated in
// docs/research/tooling-repos-2026-08.md.
//
// Providers (first configured wins):
//   - Jina Reranker  (JINA_API_KEY)   — jina-reranker-v3, multilingual
//   - Cohere Rerank  (COHERE_API_KEY) — rerank-multilingual-v3.0
//
// Design rules:
//   - OPTIONAL: if no key is configured the caller's list is returned
//     unchanged. The monitoring pipeline must never depend on a reranker.
//   - SOFT-FAIL: any network/parse/quota error logs a warning and returns the
//     input order. A reranker improves citation quality, it never breaks a run.
//   - The document text sent to the API is TITLE + SNIPPET (not the bare URL)
//     so the score reflects actual on-page relevance, mirroring how the
//     pipeline would rank a human-readable source.

import { safeFetch } from '@/lib/utils/safe-fetch'
import { logger } from '@/lib/logger'

export interface RerankSource {
  url: string
  title?: string
  snippet?: string
}

export interface RerankResult<T extends RerankSource = RerankSource> {
  /** Sources in reranked order (best first). */
  sources: T[]
  /** Provider that fulfilled the request, or null if reranking was skipped. */
  provider: 'jina' | 'cohere' | null
}

function jinaKey(): string {
  return (process.env['JINA_API_KEY'] || '').trim()
}

function cohereKey(): string {
  return (process.env['COHERE_API_KEY'] || '').trim()
}

/** Whether any reranker provider is configured. */
export function isRerankerAvailable(): boolean {
  return jinaKey().length > 0 || cohereKey().length > 0
}

function sourceToDocument(src: RerankSource): string {
  const bits = [src.title, src.snippet].filter((b) => b && b.length > 0)
  if (bits.length > 0) return bits.join(' — ')
  return src.url
}

interface RerankApiHit {
  index: number
  relevance_score?: number
  relevanceScore?: number
}

async function rerankViaJina(
  query: string,
  documents: string[],
  topN: number,
): Promise<RerankApiHit[]> {
  const key = jinaKey()
  if (!key) throw new Error('JINA_API_KEY not configured')
  const res = await safeFetch('https://api.jina.ai/v1/rerank', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'jina-reranker-v3', query, documents, top_n: topN }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Jina Reranker HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as { results?: RerankApiHit[] }
  return (data.results || []).map((r) => ({
    index: r.index,
    relevance_score: r.relevance_score ?? r.relevanceScore,
  }))
}

async function rerankViaCohere(
  query: string,
  documents: string[],
  topN: number,
): Promise<RerankApiHit[]> {
  const key = cohereKey()
  if (!key) throw new Error('COHERE_API_KEY not configured')
  const res = await safeFetch('https://api.cohere.com/v2/rerank', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'rerank-multilingual-v3.0',
      query,
      documents: documents.map((d) => ({ text: d })),
      top_n: topN,
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Cohere Rerank HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as { results?: RerankApiHit[] }
  return (data.results || []).map((r) => ({
    index: r.index,
    relevance_score: r.relevance_score ?? r.relevanceScore,
  }))
}

/**
 * Reorder sources by relevance to the query. Returns the input unchanged
 * (soft-fail) when no provider is configured or every attempt errors — the
 * pipeline never crashes because a reranker is down.
 */
export async function rerankSources<T extends RerankSource>(
  query: string,
  sources: T[],
  opts: { topN?: number } = {},
): Promise<RerankResult<T>> {
  if (!query.trim() || sources.length <= 1) {
    return { sources, provider: null }
  }

  const topN = Math.max(1, Math.min(opts.topN ?? sources.length, sources.length))
  const documents = sources.map(sourceToDocument)

  const attempts: Array<{ name: 'jina' | 'cohere'; run: () => Promise<RerankApiHit[]> }> = []
  if (jinaKey()) attempts.push({ name: 'jina', run: () => rerankViaJina(query, documents, topN) })
  if (cohereKey())
    attempts.push({ name: 'cohere', run: () => rerankViaCohere(query, documents, topN) })

  let lastError: string | null = null
  for (const attempt of attempts) {
    try {
      const hits = await attempt.run()
      if (hits.length === 0) throw new Error(`${attempt.name} returned no hits`)
      // A hit's index refers to the position in `documents` = position in `sources`.
      const byIndex = new Map(hits.map((h) => [h.index, h.relevance_score]))
      const reordered = [...sources].sort((a, b) => {
        const ia = sources.indexOf(a)
        const ib = sources.indexOf(b)
        const sa = byIndex.get(ia)
        const sb = byIndex.get(ib)
        // Unranked sources sort to the end, keeping a stable order among them.
        if (sa === undefined && sb === undefined) return ia - ib
        if (sa === undefined) return 1
        if (sb === undefined) return -1
        return sb - sa
      })
      return { sources: reordered, provider: attempt.name }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      logger.warn(`Reranker ${attempt.name} failed — keeping original order`, {
        service: 'reranker',
        provider: attempt.name,
        error: lastError,
      })
    }
  }

  if (lastError) {
    logger.warn('Reranker unavailable — keeping original order', {
      service: 'reranker',
      error: lastError,
    })
  }
  return { sources, provider: null }
}
