import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock safeFetch so reranker tests never touch the network.
const mockSafeFetch = vi.fn()
vi.mock('@/lib/utils/safe-fetch', () => ({
  safeFetch: (...args: unknown[]) => mockSafeFetch(...args),
}))

// Mock the logger (pulls Sentry in transitively — already mocked in setup).
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { rerankSources, isRerankerAvailable } from '../services/reranker'

const ENV_KEYS = ['JINA_API_KEY', 'COHERE_API_KEY'] as const

let snapshot: Record<(typeof ENV_KEYS)[number], string | undefined>

beforeEach(() => {
  mockSafeFetch.mockReset()
  snapshot = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]])) as Record<
    (typeof ENV_KEYS)[number],
    string | undefined
  >
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k]
    else process.env[k] = snapshot[k]
  }
})

const SOURCES = [
  { url: 'https://a.com', title: 'Alpha', snippet: 'First result' },
  { url: 'https://b.com', title: 'Beta', snippet: 'Second result' },
  { url: 'https://c.com', title: 'Gamma', snippet: 'Third result' },
]

describe('isRerankerAvailable', () => {
  it('false when neither key is configured', () => {
    delete process.env.JINA_API_KEY
    delete process.env.COHERE_API_KEY
    expect(isRerankerAvailable()).toBe(false)
  })

  it('true when Jina key is configured', () => {
    process.env.JINA_API_KEY = 'jina-k'
    expect(isRerankerAvailable()).toBe(true)
  })

  it('true when Cohere key is configured', () => {
    process.env.COHERE_API_KEY = 'cohere-k'
    expect(isRerankerAvailable()).toBe(true)
  })
})

describe('rerankSources', () => {
  it('returns sources unchanged when no provider is configured', async () => {
    delete process.env.JINA_API_KEY
    delete process.env.COHERE_API_KEY
    const out = await rerankSources('query about alpha', SOURCES)
    expect(out).toEqual({ sources: SOURCES, provider: null })
    expect(mockSafeFetch).not.toHaveBeenCalled()
  })

  it('skips reranking for empty query or a single source', async () => {
    process.env.JINA_API_KEY = 'jina-k'
    const empty = await rerankSources('  ', SOURCES)
    expect(empty.provider).toBeNull()
    const single = await rerankSources('q', [SOURCES[0]!])
    expect(single.provider).toBeNull()
    expect(mockSafeFetch).not.toHaveBeenCalled()
  })

  it('reorders sources best-first using Jina relevance scores', async () => {
    process.env.JINA_API_KEY = 'jina-k'
    mockSafeFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { index: 2, relevance_score: 0.95 },
            { index: 0, relevance_score: 0.6 },
            { index: 1, relevance_score: 0.3 },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const out = await rerankSources('query', SOURCES)
    expect(out.provider).toBe('jina')
    expect(out.sources.map((s) => s.url)).toEqual([
      'https://c.com',
      'https://a.com',
      'https://b.com',
    ])
  })

  it('applies topN cap before reordering', async () => {
    process.env.JINA_API_KEY = 'jina-k'
    mockSafeFetch.mockResolvedValue(
      new Response(JSON.stringify({ results: [{ index: 1, relevance_score: 0.9 }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const out = await rerankSources('q', SOURCES, { topN: 2 })
    // topN only affects how many hits the API returns; unranked sources sink.
    expect(out.sources.map((s) => s.url)).toEqual([
      'https://b.com',
      'https://a.com',
      'https://c.com',
    ])
  })

  it('soft-fails to original order when the API errors', async () => {
    process.env.JINA_API_KEY = 'jina-k'
    mockSafeFetch.mockRejectedValue(new Error('network down'))
    const out = await rerankSources('q', SOURCES)
    expect(out).toEqual({ sources: SOURCES, provider: null })
  })

  it('soft-fails on a non-2xx response', async () => {
    process.env.JINA_API_KEY = 'jina-k'
    mockSafeFetch.mockResolvedValue(new Response('quota exceeded', { status: 429 }))
    const out = await rerankSources('q', SOURCES)
    expect(out).toEqual({ sources: SOURCES, provider: null })
  })

  it('falls back to Cohere when Jina fails', async () => {
    process.env.JINA_API_KEY = 'jina-k'
    process.env.COHERE_API_KEY = 'cohere-k'
    mockSafeFetch.mockRejectedValueOnce(new Error('jina down')).mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [{ index: 0, relevance_score: 0.99 }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const out = await rerankSources('q', SOURCES)
    expect(out.provider).toBe('cohere')
    expect(out.sources[0]!.url).toBe('https://a.com')
  })
})
