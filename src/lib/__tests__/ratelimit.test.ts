import { describe, it, expect, beforeEach } from 'vitest'
import { checkRateLimit, getClientIp, type RateLimitResult } from '../ratelimit'

describe('Rate Limiting', () => {
  describe('checkRateLimit', () => {
    beforeEach(() => {
      // Clear rate limit store between tests
      // Note: In production, this would reset the in-memory store
    })

    it('allows first request within limit', async () => {
      const result = await checkRateLimit('test-user-1', 10, 60_000)
      expect(result.success).toBe(true)
      expect(result.remaining).toBe(9)
      expect(result.resetAt).toBeGreaterThan(Date.now())
    })

    it('allows requests up to limit', async () => {
      const results: RateLimitResult[] = []
      for (let i = 0; i < 10; i++) {
        results.push(await checkRateLimit('test-user-2', 10, 60_000))
      }
      expect(results[9]?.success).toBe(true)
      expect(results[9]?.remaining).toBe(0)
    })

    it('blocks requests exceeding limit', async () => {
      // Use up the limit
      for (let i = 0; i < 10; i++) {
        await checkRateLimit('test-user-3', 10, 60_000)
      }
      // Next request should be blocked
      const result = await checkRateLimit('test-user-3', 10, 60_000)
      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('tracks different identifiers separately', async () => {
      const user1 = await checkRateLimit('user-a', 2, 60_000)
      const user2 = await checkRateLimit('user-b', 2, 60_000)

      expect(user1.success).toBe(true)
      expect(user2.success).toBe(true)
      expect(user1.remaining).toBe(1)
      expect(user2.remaining).toBe(1)
    })

    it('respects custom limit and window', async () => {
      const result = await checkRateLimit('test-user-4', 5, 60_000)
      expect(result.success).toBe(true)
      expect(result.remaining).toBe(4)
    })

    it('returns correct resetAt timestamp', async () => {
      const windowMs = 60_000
      const before = Date.now()
      const result = await checkRateLimit('test-user-5', 10, windowMs)
      const after = Date.now()

      expect(result.resetAt).toBeGreaterThanOrEqual(before + windowMs)
      expect(result.resetAt).toBeLessThanOrEqual(after + windowMs)
    })
  })

  describe('getClientIp', () => {
    const createHeaders = (headers: Record<string, string | null>) => ({
      get: (key: string) => headers[key] || null,
    })

    it('extracts x-real-ip', () => {
      const headers = createHeaders({ 'x-real-ip': '192.168.1.1' })
      expect(getClientIp(headers)).toBe('192.168.1.1')
    })

    it('extracts cf-connecting-ip', () => {
      const headers = createHeaders({ 'cf-connecting-ip': '203.0.113.1' })
      expect(getClientIp(headers)).toBe('203.0.113.1')
    })

    it('extracts first IP from x-forwarded-for', () => {
      const headers = createHeaders({ 'x-forwarded-for': '203.0.113.1, 192.168.1.1' })
      expect(getClientIp(headers)).toBe('203.0.113.1')
    })

    it('prefers x-real-ip over other headers', () => {
      const headers = createHeaders({
        'x-real-ip': '10.0.0.1',
        'cf-connecting-ip': '203.0.113.1',
        'x-forwarded-for': '192.168.1.1',
      })
      expect(getClientIp(headers)).toBe('10.0.0.1')
    })

    it('returns unknown when no headers', () => {
      const headers = createHeaders({})
      expect(getClientIp(headers)).toBe('unknown')
    })

    it('handles whitespace in x-forwarded-for', () => {
      const headers = createHeaders({ 'x-forwarded-for': '  203.0.113.1,  192.168.1.1  ' })
      expect(getClientIp(headers)).toBe('203.0.113.1')
    })
  })
})
