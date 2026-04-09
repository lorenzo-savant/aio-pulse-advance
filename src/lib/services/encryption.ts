// PATH: src/lib/services/encryption.ts
// Encryption service for API keys using tweetnacl

import nacl from 'tweetnacl'

function encodeBase64(arr: Uint8Array): string {
  return Buffer.from(arr).toString('base64')
}

function decodeBase64(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, 'base64'))
}

function encodeUTF8(arr: Uint8Array): string {
  return Buffer.from(arr).toString('utf-8')
}

function decodeUTF8(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, 'utf-8'))
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY

if (!ENCRYPTION_KEY) {
  console.warn('[encryption] ENCRYPTION_KEY not set - keys will not be encrypted!')
}

function getKey(): Uint8Array | null {
  if (!ENCRYPTION_KEY) return null
  const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'base64')
  if (keyBuffer.length !== 32) {
    console.error('[encryption] ENCRYPTION_KEY must be 32 bytes (base64 encoded)')
    return null
  }
  return new Uint8Array(keyBuffer)
}

export interface EncryptedData {
  ciphertext: string
  nonce: string
  encryptionVersion: number
}

export function encryptApiKey(plaintext: string): EncryptedData {
  const key = getKey()

  // If no key, return plaintext (not recommended for production)
  if (!key) {
    return {
      ciphertext: Buffer.from(plaintext).toString('base64'),
      nonce: '',
      encryptionVersion: 0,
    }
  }

  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength)
  const messageBytes = decodeUTF8(plaintext)
  const ciphertext = nacl.secretbox(messageBytes, nonce, key)

  return {
    ciphertext: encodeBase64(ciphertext),
    nonce: encodeBase64(nonce),
    encryptionVersion: 1,
  }
}

export function decryptApiKey(encrypted: EncryptedData): string {
  const key = getKey()

  // If no key or version 0, return raw (backwards compatibility)
  if (!key || encrypted.encryptionVersion === 0) {
    return Buffer.from(encrypted.ciphertext, 'base64').toString('utf-8')
  }

  if (encrypted.encryptionVersion !== 1) {
    throw new Error(`Unknown encryption version: ${encrypted.encryptionVersion}`)
  }

  const nonce = decodeBase64(encrypted.nonce)
  const ciphertext = decodeBase64(encrypted.ciphertext)

  const decrypted = nacl.secretbox.open(ciphertext, nonce, key)

  if (!decrypted) {
    throw new Error('Decryption failed - corrupted data or wrong key')
  }

  return encodeUTF8(decrypted)
}
