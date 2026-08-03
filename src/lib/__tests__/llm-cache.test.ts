import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Redis is mocked at module level so the suite never needs a live Upstash.
const { redisGet, redisSet } = vi.hoisted(() => ({
  redisGet: vi.fn(),
  redisSet: vi.fn(),
}))

vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {
    get = redisGet
    set = redisSet
  },
}))

import {
  withLlmCache,
  hashLlmKey,
  isNonEmptyResult,
  __resetLlmCacheForTests,
} from '../services/llm-cache'

const ENV_KEYS = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'] as const
const savedEnv: Record<string, string | undefined> = {}

const deferred = <T>() => {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('llm-cache', () => {
  beforeEach(() => {
    redisGet.mockReset().mockResolvedValue(null)
    redisSet.mockReset().mockResolvedValue('OK')
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key]
    process.env['UPSTASH_REDIS_REST_URL'] = 'https://fake.upstash.io'
    process.env['UPSTASH_REDIS_REST_TOKEN'] = 'fake-token'
    __resetLlmCacheForTests()
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key]
      else process.env[key] = savedEnv[key]
    }
    __resetLlmCacheForTests()
  })

  describe('hashLlmKey', () => {
    it('is stable across payload key order', () => {
      const a = hashLlmKey({ surface: 'analysis', engine: 'chatgpt', payload: { a: 1, b: 2 } })
      const b = hashLlmKey({ surface: 'analysis', engine: 'chatgpt', payload: { b: 2, a: 1 } })
      expect(a).toBe(b)
    })

    it('separates engines, surfaces and scopes', () => {
      const base = { surface: 'analysis', engine: 'chatgpt', payload: { p: 'x' } } as const
      const hashes = new Set([
        hashLlmKey(base),
        hashLlmKey({ ...base, engine: 'claude' }),
        hashLlmKey({ ...base, surface: 'sentiment' }),
        hashLlmKey({ ...base, scope: 'brand-1' }),
        hashLlmKey({ ...base, scope: 'brand-2' }),
      ])
      expect(hashes.size).toBe(5)
    })
  })

  describe('in-process coalescing (the double-spend guard)', () => {
    it('collapses concurrent identical calls into ONE provider round-trip', async () => {
      const d = deferred<string>()
      const call = vi.fn(() => d.promise)
      const key = { surface: 'monitoring', engine: 'chatgpt', payload: { p: 'q' } } as const

      const all = Promise.all([
        withLlmCache(key, call),
        withLlmCache(key, call),
        withLlmCache(key, call),
      ])
      d.resolve('answer')

      expect(await all).toEqual(['answer', 'answer', 'answer'])
      expect(call).toHaveBeenCalledTimes(1)
    })

    it('does NOT coalesce different keys', async () => {
      const call = vi.fn(async () => 'x')
      await Promise.all([
        withLlmCache({ surface: 'monitoring', engine: 'chatgpt', payload: { p: 'a' } }, call),
        withLlmCache({ surface: 'monitoring', engine: 'chatgpt', payload: { p: 'b' } }, call),
      ])
      expect(call).toHaveBeenCalledTimes(2)
    })

    it('releases the inflight slot after settle so later calls re-run', async () => {
      const call = vi.fn(async () => 'x')
      const key = { surface: 'monitoring', engine: 'chatgpt', payload: { p: 'q' } } as const
      await withLlmCache(key, call)
      await withLlmCache(key, call)
      expect(call).toHaveBeenCalledTimes(2)
    })

    it('releases the inflight slot when the call rejects', async () => {
      const call = vi.fn(async () => {
        throw new Error('provider down')
      })
      const key = { surface: 'monitoring', engine: 'chatgpt', payload: { p: 'q' } } as const
      await expect(withLlmCache(key, call)).rejects.toThrow('provider down')
      await expect(withLlmCache(key, call)).rejects.toThrow('provider down')
      expect(call).toHaveBeenCalledTimes(2)
    })

    it('propagates a rejection to every coalesced waiter', async () => {
      const d = deferred<string>()
      const call = vi.fn(() => d.promise)
      const key = { surface: 'analysis', engine: 'chatgpt', payload: { p: 'q' } } as const
      const a = withLlmCache(key, call)
      const b = withLlmCache(key, call)
      d.reject(new Error('boom'))
      await expect(a).rejects.toThrow('boom')
      await expect(b).rejects.toThrow('boom')
      expect(call).toHaveBeenCalledTimes(1)
    })
  })

  describe('ttl semantics', () => {
    it('ttl 0 (default) never touches Redis — coalescing only', async () => {
      const call = vi.fn(async () => 'answer')
      await withLlmCache({ surface: 'monitoring', engine: 'chatgpt', payload: { p: 'q' } }, call)
      expect(redisGet).not.toHaveBeenCalled()
      expect(redisSet).not.toHaveBeenCalled()
    })

    it('ttl > 0 reads from Redis and skips the provider on a hit', async () => {
      redisGet.mockResolvedValue('cached-answer')
      const call = vi.fn(async () => 'fresh-answer')
      const result = await withLlmCache(
        { surface: 'analysis', engine: 'chatgpt', payload: { p: 'q' } },
        call,
        { ttlSeconds: 3600 },
      )
      expect(result).toBe('cached-answer')
      expect(call).not.toHaveBeenCalled()
    })

    it('ttl > 0 writes the result with the requested expiry on a miss', async () => {
      const call = vi.fn(async () => 'fresh-answer')
      const result = await withLlmCache(
        { surface: 'analysis', engine: 'chatgpt', payload: { p: 'q' } },
        call,
        { ttlSeconds: 1800 },
      )
      expect(result).toBe('fresh-answer')
      expect(redisSet).toHaveBeenCalledWith(expect.any(String), 'fresh-answer', { ex: 1800 })
    })

    it('negative ttl bypasses every layer including coalescing', async () => {
      const d = deferred<string>()
      const call = vi.fn(() => d.promise)
      const key = { surface: 'analysis', engine: 'chatgpt', payload: { p: 'q' } } as const
      const all = Promise.all([
        withLlmCache(key, call, { ttlSeconds: -1 }),
        withLlmCache(key, call, { ttlSeconds: -1 }),
      ])
      d.resolve('answer')
      await all
      expect(call).toHaveBeenCalledTimes(2)
      expect(redisGet).not.toHaveBeenCalled()
    })
  })

  describe('poison resistance', () => {
    it('does not persist an empty completion (transient provider hiccup)', async () => {
      const call = vi.fn(async () => '   ')
      await withLlmCache({ surface: 'analysis', engine: 'chatgpt', payload: { p: 'q' } }, call, {
        ttlSeconds: 3600,
      })
      expect(redisSet).not.toHaveBeenCalled()
    })

    it('does not persist an empty array result', async () => {
      const call = vi.fn(async () => [])
      await withLlmCache(
        { surface: 'prompt-generator', engine: 'groq', payload: { p: 'q' } },
        call,
        { ttlSeconds: 3600 },
      )
      expect(redisSet).not.toHaveBeenCalled()
    })

    it('honours a custom shouldCache predicate', async () => {
      const call = vi.fn(async () => ({ prompts: [], ok: false }))
      await withLlmCache(
        { surface: 'prompt-generator', engine: 'groq', payload: { p: 'q' } },
        call,
        { ttlSeconds: 3600, shouldCache: (r) => (r as { ok: boolean }).ok },
      )
      expect(redisSet).not.toHaveBeenCalled()
    })
  })

  describe('degradation', () => {
    it('treats a Redis read error as a MISS and still returns a fresh result', async () => {
      redisGet.mockRejectedValue(new Error('redis down'))
      const call = vi.fn(async () => 'fresh')
      const result = await withLlmCache(
        { surface: 'analysis', engine: 'chatgpt', payload: { p: 'q' } },
        call,
        { ttlSeconds: 600 },
      )
      expect(result).toBe('fresh')
      expect(call).toHaveBeenCalledTimes(1)
    })

    it('does not fail the request when the Redis write errors', async () => {
      redisSet.mockRejectedValue(new Error('redis down'))
      const call = vi.fn(async () => 'fresh')
      await expect(
        withLlmCache({ surface: 'analysis', engine: 'chatgpt', payload: { p: 'q' } }, call, {
          ttlSeconds: 600,
        }),
      ).resolves.toBe('fresh')
    })

    it('works with Redis unconfigured (dev) — pure coalescing', async () => {
      delete process.env['UPSTASH_REDIS_REST_URL']
      delete process.env['UPSTASH_REDIS_REST_TOKEN']
      __resetLlmCacheForTests()
      const call = vi.fn(async () => 'fresh')
      const result = await withLlmCache(
        { surface: 'analysis', engine: 'chatgpt', payload: { p: 'q' } },
        call,
        { ttlSeconds: 600 },
      )
      expect(result).toBe('fresh')
      expect(redisGet).not.toHaveBeenCalled()
    })
  })

  describe('isNonEmptyResult', () => {
    it('classifies text, arrays, objects and nullish values', () => {
      expect(isNonEmptyResult('ok')).toBe(true)
      expect(isNonEmptyResult('')).toBe(false)
      expect(isNonEmptyResult('  ')).toBe(false)
      expect(isNonEmptyResult(['a'])).toBe(true)
      expect(isNonEmptyResult([])).toBe(false)
      expect(isNonEmptyResult({ a: 1 })).toBe(true)
      expect(isNonEmptyResult(null)).toBe(false)
      expect(isNonEmptyResult(undefined)).toBe(false)
    })
  })
})
