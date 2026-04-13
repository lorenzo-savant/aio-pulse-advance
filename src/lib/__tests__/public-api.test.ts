import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  hashApiKey,
  verifyWebhook,
  rateLimitCheck,
  getRateLimitRemaining,
  getRateLimitResetAt,
} from '@/lib/services/public-api'

describe('public-api service', () => {
  describe('hashApiKey', () => {
    it('should hash API key with SHA-256', () => {
      const key = 'test-api-key-123'
      const hash = hashApiKey(key)

      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[a-f0-9]+$/)
    })

    it('should produce consistent hashes', () => {
      const key = 'my-secret-key'
      const hash1 = hashApiKey(key)
      const hash2 = hashApiKey(key)

      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different keys', () => {
      const hash1 = hashApiKey('key1')
      const hash2 = hashApiKey('key2')

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('verifyWebhook', () => {
    it('should verify valid HMAC-SHA256 signature', () => {
      const payload = '{"event":"test","data":123}'
      const secret = 'my-webhook-secret'

      const crypto = require('crypto')
      const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex')

      const isValid = verifyWebhook(payload, expectedSig, secret)
      expect(isValid).toBe(true)
    })

    it('should reject invalid signature', () => {
      const payload = '{"event":"test"}'
      const secret = 'my-secret'
      const invalidSig = 'invalid-signature-1234567890abcdef'

      const isValid = verifyWebhook(payload, invalidSig, secret)
      expect(isValid).toBe(false)
    })

    it('should reject tampered payload', () => {
      const payload = '{"event":"test"}'
      const secret = 'my-secret'

      const crypto = require('crypto')
      const originalSig = crypto.createHmac('sha256', secret).update(payload).digest('hex')

      const tamperedPayload = '{"event":"hacked"}'
      const isValid = verifyWebhook(tamperedPayload, originalSig, secret)
      expect(isValid).toBe(false)
    })

    it('should reject wrong secret', () => {
      const payload = '{"event":"test"}'
      const correctSecret = 'correct-secret'
      const wrongSecret = 'wrong-secret'

      const crypto = require('crypto')
      const sig = crypto.createHmac('sha256', correctSecret).update(payload).digest('hex')

      const isValid = verifyWebhook(payload, sig, wrongSecret)
      expect(isValid).toBe(false)
    })
  })

  describe('rateLimitCheck', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should allow requests under limit', () => {
      const key = 'test-key'

      for (let i = 0; i < 60; i++) {
        expect(rateLimitCheck(key)).toBe(true)
      }
    })

    it('should block requests over limit', () => {
      const key = 'test-key-limit'

      for (let i = 0; i < 60; i++) {
        rateLimitCheck(key)
      }

      expect(rateLimitCheck(key)).toBe(false)
    })

    it('should reset after window expires', () => {
      const key = 'test-key-reset'

      for (let i = 0; i < 60; i++) {
        rateLimitCheck(key)
      }

      expect(rateLimitCheck(key)).toBe(false)

      vi.advanceTimersByTime(60001)

      expect(rateLimitCheck(key)).toBe(true)
    })

    it('should track different keys separately', () => {
      const key1 = 'key-one'
      const key2 = 'key-two'

      for (let i = 0; i < 60; i++) {
        rateLimitCheck(key1)
      }

      expect(rateLimitCheck(key1)).toBe(false)
      expect(rateLimitCheck(key2)).toBe(true)
    })
  })

  describe('getRateLimitRemaining', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return full limit for new key', () => {
      const key = 'new-key'
      expect(getRateLimitRemaining(key)).toBe(60)
    })

    it('should return correct remaining count', () => {
      const key = 'key-remaining'
      rateLimitCheck(key)
      rateLimitCheck(key)

      expect(getRateLimitRemaining(key)).toBe(58)
    })

    it('should return 0 when limit exceeded', () => {
      const key = 'key-exceeded'

      for (let i = 0; i < 60; i++) {
        rateLimitCheck(key)
      }

      expect(getRateLimitRemaining(key)).toBe(0)
    })
  })

  describe('getRateLimitResetAt', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return future timestamp for new key', () => {
      const key = 'new-key-reset'
      const now = Date.now()
      const resetAt = getRateLimitResetAt(key)

      expect(resetAt).toBeGreaterThan(now)
      expect(resetAt).toBeLessThanOrEqual(now + 60000)
    })

    it('should return same resetAt for same key', () => {
      const key = 'key-same'
      rateLimitCheck(key)
      const resetAt1 = getRateLimitResetAt(key)
      const resetAt2 = getRateLimitResetAt(key)

      expect(resetAt1).toBe(resetAt2)
    })
  })
})
