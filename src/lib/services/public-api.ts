import { createHash, createHmac, timingSafeEqual } from 'crypto'

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex')
  const signatureBuffer = Buffer.from(signature, 'hex')
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')
  if (signatureBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(signatureBuffer, expectedBuffer)
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 60
const WINDOW_MS = 60_000

export function rateLimitCheck(key: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

export function getRateLimitRemaining(key: string): number {
  const entry = rateLimitStore.get(key)
  if (!entry || entry.resetAt < Date.now()) return RATE_LIMIT
  return Math.max(0, RATE_LIMIT - entry.count)
}

export function getRateLimitResetAt(key: string): number {
  const entry = rateLimitStore.get(key)
  if (!entry) return Date.now() + WINDOW_MS
  return entry.resetAt
}
