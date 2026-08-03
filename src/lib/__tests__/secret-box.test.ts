import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { randomBytes } from 'crypto'
import { encryptSecret, decryptSecret, isEncrypted, maskSecret } from '../crypto/secret-box'

// secret-box encrypts customer-provided provider API keys at rest
// (user_api_keys.encrypted_key). A regression here silently corrupts every
// stored secret, so the round-trip and tamper cases are locked down.

const savedKey = { value: undefined as string | undefined }

describe('secret-box', () => {
  beforeEach(() => {
    savedKey.value = process.env['ENCRYPTION_KEY']
    process.env['ENCRYPTION_KEY'] = randomBytes(32).toString('hex')
  })

  afterEach(() => {
    if (savedKey.value === undefined) delete process.env['ENCRYPTION_KEY']
    else process.env['ENCRYPTION_KEY'] = savedKey.value
  })

  describe('encryptSecret / decryptSecret round-trip', () => {
    it('round-trips a typical provider API key', () => {
      const plaintext = 'sk-proj-abc123XYZ_verySecretKey456'
      const encrypted = encryptSecret(plaintext)
      expect(encrypted).not.toContain(plaintext)
      expect(decryptSecret(encrypted)).toBe(plaintext)
    })

    it('round-trips unicode and empty-ish payloads', () => {
      for (const plaintext of ['å-nyckel-🔑-ключ', ' ', 'a']) {
        expect(decryptSecret(encryptSecret(plaintext))).toBe(plaintext)
      }
    })

    it('produces a unique ciphertext per call (random IV)', () => {
      const plaintext = 'same-secret'
      expect(encryptSecret(plaintext)).not.toBe(encryptSecret(plaintext))
    })

    it('emits the versioned enc.v1 format', () => {
      const encrypted = encryptSecret('secret')
      expect(encrypted.startsWith('enc.v1.')).toBe(true)
      expect(encrypted.slice('enc.v1.'.length).split('.')).toHaveLength(3)
    })
  })

  describe('key derivation', () => {
    it('accepts a 64-char hex key directly', () => {
      process.env['ENCRYPTION_KEY'] = 'a'.repeat(64)
      expect(decryptSecret(encryptSecret('x'))).toBe('x')
    })

    it('derives a stable key from an arbitrary passphrase via SHA-256', () => {
      process.env['ENCRYPTION_KEY'] = 'not-hex-but-long-enough-passphrase'
      const encrypted = encryptSecret('payload')
      expect(decryptSecret(encrypted)).toBe('payload')
    })

    it('throws a clear error when ENCRYPTION_KEY is missing', () => {
      delete process.env['ENCRYPTION_KEY']
      expect(() => encryptSecret('x')).toThrow(/ENCRYPTION_KEY/)
    })

    it('throws when ENCRYPTION_KEY is too short', () => {
      process.env['ENCRYPTION_KEY'] = 'short'
      expect(() => encryptSecret('x')).toThrow(/ENCRYPTION_KEY/)
    })
  })

  describe('tamper resistance (GCM auth tag)', () => {
    it('rejects a tampered ciphertext', () => {
      const encrypted = encryptSecret('secret-value')
      const parts = encrypted.slice('enc.v1.'.length).split('.')
      const ct = Buffer.from(parts[2]!, 'base64')
      ct[0] = ct[0]! ^ 0xff
      const tampered = `enc.v1.${parts[0]}.${parts[1]}.${ct.toString('base64')}`
      expect(() => decryptSecret(tampered)).toThrow()
    })

    it('rejects decryption with a different key', () => {
      const encrypted = encryptSecret('secret-value')
      process.env['ENCRYPTION_KEY'] = randomBytes(32).toString('hex')
      expect(() => decryptSecret(encrypted)).toThrow()
    })

    it('rejects values not in enc.v1 format', () => {
      expect(() => decryptSecret('plain-api-key')).toThrow(/enc\.v1/)
    })

    it('rejects a malformed enc.v1 payload', () => {
      expect(() => decryptSecret('enc.v1.onlyonepart')).toThrow(/malformed/)
    })
  })

  describe('isEncrypted', () => {
    it('detects encrypted values', () => {
      expect(isEncrypted(encryptSecret('x'))).toBe(true)
    })

    it('rejects plaintext, null and undefined', () => {
      expect(isEncrypted('sk-plaintext')).toBe(false)
      expect(isEncrypted(null)).toBe(false)
      expect(isEncrypted(undefined)).toBe(false)
    })
  })

  describe('maskSecret', () => {
    it('keeps first 3 and last 4 chars of a long secret', () => {
      const masked = maskSecret('sk-proj-abcdefgh1234')
      expect(masked.startsWith('sk-')).toBe(true)
      expect(masked.endsWith('1234')).toBe(true)
      expect(masked).not.toContain('abcdefgh')
    })

    it('fully masks short secrets', () => {
      expect(maskSecret('short')).toBe('••••••••')
      expect(maskSecret('12345678')).toBe('••••••••')
    })
  })
})
