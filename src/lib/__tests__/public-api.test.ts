import { describe, it, expect } from 'vitest'
import { hashApiKey, verifyWebhook } from '@/lib/services/public-api'

// Rate-limit behavior is no longer tested here — public-api.ts now delegates
// to lib/ratelimit.ts (Upstash-backed). The in-memory implementation was
// incorrect on serverless (per-container counters defeat the limit) and was
// removed in the v2.2.0 hardening pass. The Upstash path is exercised via
// the ratelimit module's own tests.

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
})
