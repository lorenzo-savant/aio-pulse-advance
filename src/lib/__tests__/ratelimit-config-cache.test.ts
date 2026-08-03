import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Regression test for the per-config Ratelimit cache. The original bug:
// getRatelimit() cached a SINGLE Ratelimit instance and ignored the
// (limit, windowMs) arguments of every later call — so whichever route
// warmed the lambda first imposed its limits on all 49 rate-limited
// routes (e.g. a 3/min endpoint silently running at 30/min).

const { ratelimitCtor, limitMock, slidingWindowMock } = vi.hoisted(() => ({
  ratelimitCtor: vi.fn(),
  limitMock: vi.fn(),
  slidingWindowMock: vi.fn((limit: number, window: string) => ({ limit, window })),
}))

vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {},
}))

vi.mock('@upstash/ratelimit', () => {
  class MockRatelimit {
    static slidingWindow = slidingWindowMock
    limit = limitMock
    constructor(config: unknown) {
      ratelimitCtor(config)
    }
  }
  return { Ratelimit: MockRatelimit }
})

const ENV_KEYS = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'] as const
const savedEnv: Record<string, string | undefined> = {}

describe('checkRateLimit — per-config Redis instances', () => {
  beforeEach(() => {
    vi.resetModules()
    ratelimitCtor.mockClear()
    slidingWindowMock.mockClear()
    limitMock.mockClear()
    limitMock.mockResolvedValue({ success: true, remaining: 1, reset: Date.now() + 60_000 })
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key]
    process.env['UPSTASH_REDIS_REST_URL'] = 'https://fake.upstash.io'
    process.env['UPSTASH_REDIS_REST_TOKEN'] = 'fake-token'
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key]
      else process.env[key] = savedEnv[key]
    }
  })

  it('creates a distinct Ratelimit instance per (limit, windowMs) config', async () => {
    const { checkRateLimit } = await import('../ratelimit')

    await checkRateLimit('user-1', 3, 60_000)
    await checkRateLimit('user-1', 30, 60_000)
    await checkRateLimit('user-1', 3, 10_000)

    expect(ratelimitCtor).toHaveBeenCalledTimes(3)
    expect(slidingWindowMock).toHaveBeenCalledWith(3, '60000ms')
    expect(slidingWindowMock).toHaveBeenCalledWith(30, '60000ms')
    expect(slidingWindowMock).toHaveBeenCalledWith(3, '10000ms')
  })

  it('reuses the cached instance for an identical config', async () => {
    const { checkRateLimit } = await import('../ratelimit')

    await checkRateLimit('user-1', 5, 60_000)
    await checkRateLimit('user-2', 5, 60_000)
    await checkRateLimit('user-3', 5, 60_000)

    expect(ratelimitCtor).toHaveBeenCalledTimes(1)
    expect(limitMock).toHaveBeenCalledTimes(3)
  })

  it('isolates Redis key prefixes per config so counters never collide', async () => {
    const { checkRateLimit } = await import('../ratelimit')

    await checkRateLimit('user-1', 3, 60_000)
    await checkRateLimit('user-1', 100, 60_000)

    const prefixes = ratelimitCtor.mock.calls.map((call) => (call[0] as { prefix: string }).prefix)
    expect(prefixes).toContain('aio-pulse:rl:3:60000')
    expect(prefixes).toContain('aio-pulse:rl:100:60000')
    expect(new Set(prefixes).size).toBe(prefixes.length)
  })
})
