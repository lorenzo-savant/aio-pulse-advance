import { describe, it, expect, vi } from 'vitest'

// Force the no-DB path so we exercise the in-memory promise coalescing layer
// without needing a Supabase fixture. The db cache layer is a separate
// integration concern.
vi.mock('@/lib/supabase', () => ({
  createServerClient: () => null,
}))

import { withSerpCache } from '../services/serp-cache'

describe('withSerpCache', () => {
  it('coalesces concurrent calls with the same key into one upstream call', async () => {
    const upstream = vi.fn().mockImplementation(async () => {
      // Simulate latency so both callers race before resolution.
      await new Promise((r) => setTimeout(r, 20))
      return { ok: true, n: Math.random() }
    })

    const [a, b, c] = await Promise.all([
      withSerpCache(
        { provider: 'brave', endpoint: 'web/search', params: { q: 'pizza' } },
        upstream,
      ),
      withSerpCache(
        { provider: 'brave', endpoint: 'web/search', params: { q: 'pizza' } },
        upstream,
      ),
      withSerpCache(
        { provider: 'brave', endpoint: 'web/search', params: { q: 'pizza' } },
        upstream,
      ),
    ])

    expect(upstream).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it('parameter ORDER does not affect the key', async () => {
    const upstream = vi.fn().mockResolvedValue('shared')
    const r1 = await withSerpCache(
      { provider: 'brave', endpoint: 'web/search', params: { q: 'x', count: 10 } },
      upstream,
    )
    const r2 = await withSerpCache(
      { provider: 'brave', endpoint: 'web/search', params: { count: 10, q: 'x' } },
      upstream,
    )
    // In-memory dedup window is per-promise, so once the first resolved the
    // map is cleared. Without DB cache the second call DOES re-fire — that's
    // expected. What matters is the *hash* is identical, which we prove by
    // forcing concurrency:
    const upstream2 = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10))
      return 'shared2'
    })
    const [s1, s2] = await Promise.all([
      withSerpCache(
        { provider: 'brave', endpoint: 'web/search', params: { q: 'y', count: 1 } },
        upstream2,
      ),
      withSerpCache(
        { provider: 'brave', endpoint: 'web/search', params: { count: 1, q: 'y' } },
        upstream2,
      ),
    ])
    expect(r1).toBe('shared')
    expect(r2).toBe('shared')
    expect(s1).toBe('shared2')
    expect(s2).toBe('shared2')
    expect(upstream2).toHaveBeenCalledTimes(1)
  })

  it('different keys do NOT coalesce', async () => {
    let i = 0
    const upstream = vi.fn().mockImplementation(async () => ++i)
    const [a, b] = await Promise.all([
      withSerpCache({ provider: 'brave', endpoint: 'web/search', params: { q: 'a' } }, upstream),
      withSerpCache({ provider: 'brave', endpoint: 'web/search', params: { q: 'b' } }, upstream),
    ])
    expect(upstream).toHaveBeenCalledTimes(2)
    expect(a).not.toBe(b)
  })

  it('negative ttl forces refresh (skips memory + db dedup)', async () => {
    const upstream = vi.fn().mockResolvedValue('fresh')
    const [a, b] = await Promise.all([
      withSerpCache(
        { provider: 'brave', endpoint: 'web/search', params: { q: 'z' } },
        upstream,
        -1,
      ),
      withSerpCache(
        { provider: 'brave', endpoint: 'web/search', params: { q: 'z' } },
        upstream,
        -1,
      ),
    ])
    expect(upstream).toHaveBeenCalledTimes(2)
    expect(a).toBe('fresh')
    expect(b).toBe('fresh')
  })

  it('shouldCache predicate receives the result and does not alter the return value', async () => {
    // No-DB path here, so we can't assert the write was skipped; we assert the
    // predicate is consulted with the real result and the value still returns.
    const shouldCache = vi.fn((r: string[]) => r.length > 0)

    const empty = await withSerpCache<string[]>(
      { provider: 'dataforseo', endpoint: 'paa', params: { keyword: 'no-box' } },
      async () => [],
      undefined,
      { shouldCache },
    )
    expect(empty).toEqual([])
    expect(shouldCache).toHaveBeenCalledWith([])
    expect(shouldCache).toHaveLastReturnedWith(false)

    const full = await withSerpCache<string[]>(
      { provider: 'dataforseo', endpoint: 'paa', params: { keyword: 'has-box' } },
      async () => ['q1', 'q2'],
      undefined,
      { shouldCache },
    )
    expect(full).toEqual(['q1', 'q2'])
    expect(shouldCache).toHaveLastReturnedWith(true)
  })

  it('upstream errors propagate AND clear the inflight entry', async () => {
    const upstream = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(
      withSerpCache({ provider: 'brave', endpoint: 'web/search', params: { q: 'err' } }, upstream),
    ).rejects.toThrow('boom')

    // After failure, a fresh call should re-invoke upstream (the cleanup in
    // the finally block must have removed the rejected promise).
    const ok = vi.fn().mockResolvedValue('recovered')
    const r = await withSerpCache(
      { provider: 'brave', endpoint: 'web/search', params: { q: 'err' } },
      ok,
    )
    expect(ok).toHaveBeenCalledTimes(1)
    expect(r).toBe('recovered')
  })
})
