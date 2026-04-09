// PATH: src/lib/api-cache.ts
//
// ─── API Response Caching ───────────────────────────────────────────────────────
//
// Two layers:
//   1. HTTP Cache Headers (CDN/browser caching)
//   2. Data Cache (Redis + in-memory fallback)
//
// Usage:
//   const cached = await dataCache.get('key')
//   if (cached) return cached
//   const data = await fetchData()
//   await dataCache.set('key', data, 300)
//

import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP Cache Headers
// ═══════════════════════════════════════════════════════════════════════════════

export interface CacheOptions {
  maxAge?: number
  staleWhileRevalidate?: number
  swr?: boolean
  noStore?: boolean
  noCache?: boolean
}

export const CACHE_CONFIGS: Record<string, CacheOptions> = {
  '/api/brands': { maxAge: 60, swr: true },
  '/api/prompts': { maxAge: 30, swr: true },
  '/api/scans': { maxAge: 30, swr: true },
  '/api/monitoring': { maxAge: 15, swr: true },
  '/api/recommendations': { maxAge: 60, swr: true },
}

export function applyCacheHeaders(
  request: NextRequest,
  response: NextResponse,
  customOptions?: CacheOptions,
): NextResponse {
  const pathname = request.nextUrl.pathname

  const config = Object.entries(CACHE_CONFIGS).find(([pattern]) => pathname.startsWith(pattern))
  const options = customOptions ?? config?.[1]

  if (!options) {
    return response
  }

  if (options.noStore) {
    response.headers.set('Cache-Control', 'no-store')
    return response
  }

  if (options.noCache) {
    response.headers.set('Cache-Control', 'no-cache')
    return response
  }

  const maxAge = options.maxAge ?? 60
  const swr = options.swr ?? true
  const staleWhileRevalidate = options.staleWhileRevalidate ?? maxAge * 10

  if (swr) {
    response.headers.set(
      'Cache-Control',
      `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    )
  } else {
    response.headers.set('Cache-Control', `public, max-age=${maxAge}`)
  }

  response.headers.set('Vary', 'Cookie, Authorization')
  response.headers.set('X-Cache-Status', 'HIT')

  return response
}

export function addStaleWhileRevalidate(response: NextResponse, maxAge: number): NextResponse {
  response.headers.set(
    'Cache-Control',
    `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 10}`,
  )
  return response
}

export function setCacheControl(
  response: NextResponse,
  directive: 'no-store' | 'no-cache' | 'public' | 'private',
  maxAge?: number,
): NextResponse {
  const parts: string[] = [directive]
  if (maxAge !== undefined) {
    parts.push(`max-age=${maxAge}`)
  }
  response.headers.set('Cache-Control', parts.join(', '))
  return response
}

// ═══════════════════════════════════════════════════════════════════════════════
// Data Cache (Redis + Memory Fallback)
// ═══════════════════════════════════════════════════════════════════════════════

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class DataCache {
  private redis: Redis | null = null
  private memoryStore = new Map<string, CacheEntry<unknown>>()
  private prefix = 'aio-pulse:cache'

  constructor() {
    this.initRedis()
  }

  private initRedis(): void {
    const url = process.env['UPSTASH_REDIS_REST_URL']
    const token = process.env['UPSTASH_REDIS_REST_TOKEN']
    if (url && token) {
      this.redis = new Redis({ url, token })
    }
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`
  }

  async get<T>(key: string): Promise<T | null> {
    const cacheKey = this.getKey(key)

    if (this.redis) {
      try {
        const cached = await this.redis.get<CacheEntry<T>>(cacheKey)
        if (cached && cached.expiresAt > Date.now()) {
          return cached.data
        }
        if (cached) {
          await this.redis.del(cacheKey)
        }
      } catch {
        // Fall through to memory
      }
    }

    const entry = this.memoryStore.get(cacheKey) as CacheEntry<T> | undefined
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data
    }
    return null
  }

  async set<T>(key: string, data: T, ttl = 300): Promise<void> {
    const cacheKey = this.getKey(key)
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttl * 1000 }

    if (this.redis) {
      try {
        await this.redis.set(cacheKey, entry, { ex: ttl })
      } catch {
        // Fall through to memory
      }
    }

    this.memoryStore.set(cacheKey, entry as CacheEntry<unknown>)
  }

  async delete(key: string): Promise<void> {
    const cacheKey = this.getKey(key)
    if (this.redis) {
      try {
        await this.redis.del(cacheKey)
      } catch {
        // Continue
      }
    }
    this.memoryStore.delete(cacheKey)
  }

  async invalidatePattern(pattern: string): Promise<number> {
    const searchPattern = this.getKey(pattern.replace('*', '*'))
    let deleted = 0

    if (this.redis) {
      try {
        const keys = await this.redis.keys(searchPattern)
        if (keys.length) {
          deleted = await this.redis.del(...keys)
        }
      } catch {
        // Continue
      }
    }

    for (const key of this.memoryStore.keys()) {
      const regex = new RegExp('^' + searchPattern.replace(/\*/g, '.*') + '$')
      if (regex.test(key)) {
        this.memoryStore.delete(key)
        deleted++
      }
    }

    return deleted
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.memoryStore.entries()) {
      if (entry.expiresAt < now) {
        this.memoryStore.delete(key)
      }
    }
  }
}

export const dataCache = new DataCache()

if (typeof setInterval !== 'undefined') {
  setInterval(() => dataCache.cleanup(), 60_000)
}
