// PATH: src/lib/services/semantic.ts
//
// Lightweight semantic layer (embeddings + cosine) for prompt de-duplication.
//
// Design note: a brand has a SMALL set of prompts (tens, not millions), so we
// store embeddings as jsonb and compute cosine similarity IN MEMORY rather than
// enabling the pgvector extension + an ANN index. It's simpler, has zero
// per-query vector-op cost, and is exact. pgvector is the right upgrade only at
// large scale (e.g. clustering thousands of monitoring RESPONSES) — documented
// as the next step, not needed here.
//
// embedText soft-fails (returns null) when OPENAI_API_KEY is absent or the call
// errors, so dedup is a best-effort enhancement that never blocks prompt
// creation. The math (cosineSimilarity / mostSimilar) is pure + unit-tested.

import { safeFetch } from '@/lib/utils/safe-fetch'

const EMBEDDING_MODEL = 'text-embedding-3-small' // 1536-dim, cheap (~$0.02/1M tokens)

/** Cosine similarity of two equal-length vectors, in [-1, 1]. 0 on bad input. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    dot += x * y
    na += x * x
    nb += y * y
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

export interface EmbeddedItem {
  text: string
  embedding: number[]
  id?: string
}

/** The candidate most similar to `target`, with a rounded score, or null. */
export function mostSimilar(
  target: number[],
  candidates: EmbeddedItem[],
): { text: string; id?: string; score: number } | null {
  if (!target?.length || !candidates?.length) return null
  let best: { text: string; id?: string; score: number } | null = null
  for (const c of candidates) {
    const score = cosineSimilarity(target, c.embedding)
    if (!best || score > best.score) {
      best = { text: c.text, id: c.id, score: Math.round(score * 1000) / 1000 }
    }
  }
  return best
}

/** Cosine threshold above which two prompts are treated as near-duplicates. */
export const NEAR_DUPLICATE_THRESHOLD = 0.92

/**
 * Embed a single text via OpenAI text-embedding-3-small. Soft-fails to null
 * (no key / error / empty input) so callers degrade gracefully.
 */
export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env['OPENAI_API_KEY']
  const input = (text || '').trim()
  if (!apiKey || !input) return null
  try {
    const res = await safeFetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: input.slice(0, 8000) }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> }
    const vec = data.data?.[0]?.embedding
    return Array.isArray(vec) && vec.length > 0 ? vec : null
  } catch {
    return null
  }
}

/**
 * Batch-embed many texts in a SINGLE API call (the embeddings endpoint accepts
 * an array). Returns embeddings aligned to the input order, or null on failure.
 * Used by thematic clustering to embed a page of responses cheaply.
 */
export async function embedTexts(texts: string[]): Promise<Array<number[] | null> | null> {
  const apiKey = process.env['OPENAI_API_KEY']
  if (!apiKey || !texts.length) return null
  // Empty strings aren't valid input — substitute a placeholder, null them after.
  const inputs = texts.map((t) => ((t || '').trim() || ' ').slice(0, 8000))
  try {
    const res = await safeFetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { data?: Array<{ index?: number; embedding?: number[] }> }
    const out: Array<number[] | null> = new Array(texts.length).fill(null)
    for (const row of data.data ?? []) {
      const i = typeof row.index === 'number' ? row.index : -1
      if (i >= 0 && i < out.length && Array.isArray(row.embedding) && row.embedding.length > 0) {
        out[i] = (texts[i] || '').trim() ? row.embedding : null
      }
    }
    return out
  } catch {
    return null
  }
}
