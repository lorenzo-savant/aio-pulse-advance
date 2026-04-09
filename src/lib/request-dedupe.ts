// PATH: src/lib/request-dedupe.ts
//
// ─── Request Deduplication ─────────────────────────────────────────────────────
//
// Prevents duplicate AI API calls within a time window.
// Uses in-memory Map for fast deduplication.
//
// Usage:
//   const result = await deduplicate('key', () => expensiveOperation())
//

type DedupeKey = string | number

interface PendingRequest<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
  expiresAt: number
}

class RequestDeduplicator {
  private pending = new Map<DedupeKey, PendingRequest<unknown>>()
  private windowMs: number

  constructor(windowMs = 30_000) {
    this.windowMs = windowMs
    this.startCleanup()
  }

  private startCleanup(): void {
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), 60_000)
    }
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, req] of this.pending.entries()) {
      if (req.expiresAt < now) {
        this.pending.delete(key)
      }
    }
  }

  async deduplicate<T>(key: DedupeKey, fn: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key) as PendingRequest<T> | undefined

    if (existing) {
      return existing.promise
    }

    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void

    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })

    const pending: PendingRequest<T> = {
      promise,
      resolve,
      reject,
      expiresAt: Date.now() + this.windowMs,
    }

    this.pending.set(key, pending as PendingRequest<unknown>)

    try {
      const result = await fn()
      resolve(result)
      return result
    } catch (error) {
      reject(error)
      throw error
    } finally {
      this.pending.delete(key)
    }
  }

  isPending(key: DedupeKey): boolean {
    return this.pending.has(key)
  }

  clear(): void {
    this.pending.clear()
  }
}

export const deduplicator = new RequestDeduplicator(30_000)

export async function deduplicate<T>(
  key: string,
  fn: () => Promise<T>,
  windowMs = 30_000,
): Promise<T> {
  const hash = await hashKey(key)
  return deduplicator.deduplicate(hash, fn)
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .slice(0, 16)
    .join('')
}

export function createDedupeKey(...parts: unknown[]): string {
  return parts.map((p) => JSON.stringify(p)).join(':')
}
