import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
}

export function checkRateLimit(
  identifier: string,
  maxRequests: number = RATE_LIMIT_MAX_REQUESTS,
): RateLimitResult {
  const now = Date.now()
  const record = rateLimitMap.get(identifier)

  if (!record || now > record.resetTime) {
    const resetTime = now + RATE_LIMIT_WINDOW_MS
    rateLimitMap.set(identifier, { count: 1, resetTime })
    return { allowed: true, remaining: maxRequests - 1, resetTime }
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime }
  }

  record.count++
  return { allowed: true, remaining: maxRequests - record.count, resetTime: record.resetTime }
}

export function getRateLimitIdentifier(req: NextRequest): string {
  const authHeader = req.headers.get('authorization')
  const cookieHeader = req.headers.get('cookie')

  if (authHeader) {
    return `token:${authHeader.slice(0, 20)}`
  }

  if (cookieHeader) {
    const cookies = cookieHeader.split(';')
    for (const cookie of cookies) {
      const [name] = cookie.trim().split('=')
      if (name?.includes('sb-')) {
        return `cookie:${name}`
      }
    }
  }

  return `ip:${req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'}`
}

export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  maxRequests?: number,
) {
  return async function rateLimitedHandler(req: NextRequest): Promise<NextResponse> {
    const identifier = getRateLimitIdentifier(req)
    const { allowed, remaining, resetTime } = checkRateLimit(identifier, maxRequests)

    const response = await handler(req)

    response.headers.set('X-RateLimit-Limit', String(maxRequests || RATE_LIMIT_MAX_REQUESTS))
    response.headers.set('X-RateLimit-Remaining', String(remaining))
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)))

    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((resetTime - Date.now()) / 1000)),
          },
        },
      )
    }

    return response
  }
}

export function cleanupRateLimitMap() {
  const now = Date.now()
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime + RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(key)
    }
  }
}

if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitMap, 5 * 60 * 1000)
}
