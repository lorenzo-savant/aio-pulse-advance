import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

/**
 * Authenticated symmetric encryption for secrets at rest (e.g. user-provided
 * provider API keys stored in user_api_keys.encrypted_key).
 *
 * Algorithm: AES-256-GCM, random 12-byte IV per record, 16-byte auth tag.
 * Serialized format: `enc.v1.<ivB64>.<tagB64>.<ciphertextB64>`
 *
 * The 32-byte key is derived from the ENCRYPTION_KEY env var:
 *  - if it is 64 hex chars → used directly as 32 raw bytes
 *  - otherwise → SHA-256(ENCRYPTION_KEY) (stable 32-byte derivation)
 */

const PREFIX = 'enc.v1.'

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw || raw.length < 16) {
    throw new Error(
      'ENCRYPTION_KEY is missing or too short. Generate one with: ' +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    )
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex')
  }
  // Deterministic 32-byte key from an arbitrary-length secret.
  return createHash('sha256').update(raw).digest()
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

export function encryptSecret(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return (
    PREFIX +
    [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.')
  )
}

export function decryptSecret(payload: string): string {
  if (!isEncrypted(payload)) {
    throw new Error('decryptSecret: value is not in the expected enc.v1 format')
  }
  const [ivB64, tagB64, ctB64] = payload.slice(PREFIX.length).split('.')
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error('decryptSecret: malformed ciphertext payload')
  }
  const key = getKey()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()])
  return plaintext.toString('utf8')
}

/** Mask a secret for safe display: keep first 3 / last 4 chars. */
export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 8) return '••••••••'
  return `${plaintext.slice(0, 3)}${'•'.repeat(12)}${plaintext.slice(-4)}`
}
