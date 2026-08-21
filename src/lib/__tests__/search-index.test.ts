import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mockSafeFetch = vi.fn()
vi.mock('@/lib/utils/safe-fetch', () => ({
  safeFetch: (...args: unknown[]) => mockSafeFetch(...args),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { isMeilisearchConfigured, searchInternal } from '../services/search-index'

const ENV_KEYS = ['MEILISEARCH_HOST', 'MEILISEARCH_API_KEY'] as const
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

describe('isMeilisearchConfigured', () => {
  it('false when neither var is set', () => {
    delete process.env.MEILISEARCH_HOST
    delete process.env.MEILISEARCH_API_KEY
    expect(isMeilisearchConfigured()).toBe(false)
  })

  it('false when only host is set', () => {
    process.env.MEILISEARCH_HOST = 'http://127.0.0.1:7700'
    delete process.env.MEILISEARCH_API_KEY
    expect(isMeilisearchConfigured()).toBe(false)
  })

  it('true when both are set', () => {
    process.env.MEILISEARCH_HOST = 'http://127.0.0.1:7700'
    process.env.MEILISEARCH_API_KEY = 'k'
    expect(isMeilisearchConfigured()).toBe(true)
  })
})

describe('searchInternal', () => {
  it('returns null (→ ILIKE fallback) when not configured', async () => {
    delete process.env.MEILISEARCH_HOST
    delete process.env.MEILISEARCH_API_KEY
    expect(await searchInternal('acme', ['b1'])).toBeNull()
    expect(mockSafeFetch).not.toHaveBeenCalled()
  })

  it('returns null on HTTP error (→ ILIKE fallback)', async () => {
    process.env.MEILISEARCH_HOST = 'http://127.0.0.1:7700'
    process.env.MEILISEARCH_API_KEY = 'k'
    mockSafeFetch.mockResolvedValue(new Response('boom', { status: 500 }))
    expect(await searchInternal('acme', ['b1'])).toBeNull()
  })

  it('returns null on network error (→ ILIKE fallback)', async () => {
    process.env.MEILISEARCH_HOST = 'http://127.0.0.1:7700'
    process.env.MEILISEARCH_API_KEY = 'k'
    mockSafeFetch.mockRejectedValue(new Error('connection refused'))
    expect(await searchInternal('acme', ['b1'])).toBeNull()
  })

  it('maps hits to the route result shape', async () => {
    process.env.MEILISEARCH_HOST = 'http://127.0.0.1:7700'
    process.env.MEILISEARCH_API_KEY = 'k'
    mockSafeFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          hits: [
            { id: 'brand-1', type: 'brand', name: 'Acme Corp' },
            { id: 'prompt-1', type: 'prompt', name: 'What is Acme?' },
            { id: 'junk', type: 'bogus', name: 'ignored' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const out = await searchInternal('acme', ['brand-1', 'brand-2'])
    expect(out).toEqual({
      servedByIndex: true,
      hits: [
        { id: 'brand-1', type: 'brand', name: 'Acme Corp' },
        { id: 'prompt-1', type: 'prompt', name: 'What is Acme?' },
      ],
    })
    // Multi-tenant filter must scope the query to accessible brands.
    const call = mockSafeFetch.mock.calls[0] as unknown as [string, { body: string }]
    const body = JSON.parse(call[1]!.body as string) as { filter: string }
    expect(body.filter).toContain('"brand-1"')
    expect(body.filter).toContain('"brand-2"')
  })

  it('returns empty hits for an empty query (no network)', async () => {
    process.env.MEILISEARCH_HOST = 'http://127.0.0.1:7700'
    process.env.MEILISEARCH_API_KEY = 'k'
    const out = await searchInternal('   ', ['b1'])
    expect(out).toEqual({ hits: [], servedByIndex: true })
    expect(mockSafeFetch).not.toHaveBeenCalled()
  })
})
