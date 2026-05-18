import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient as createSSRClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/types/database'
import { logger } from '@/lib/logger'

const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
const supabaseServiceKey = process.env['SUPABASE_SERVICE_KEY']

const isConfigured = !!supabaseUrl && !!supabaseAnonKey

if (!isConfigured && process.env.NODE_ENV === 'production') {
  throw new Error(
    'FATAL: Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) are missing in production. Aborting.',
  )
}

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  CRITICAL SECURITY GUARD (CF-01)                                           ║
// ║  Refuse to boot if DEV_USER_ID is set in any production environment.       ║
// ║  This protects against accidental leak of dev env vars into prod, which    ║
// ║  would otherwise allow authentication bypass via the per-request check     ║
// ║  in getCurrentUserId(). Defense in depth — checks both NODE_ENV and        ║
// ║  Vercel-specific VERCEL_ENV signals.                                        ║
// ╚════════════════════════════════════════════════════════════════════════════╝
if (
  process.env.DEV_USER_ID &&
  (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production')
) {
  throw new Error(
    'SECURITY FATAL: DEV_USER_ID environment variable is set in a production environment. ' +
      'This would permit authentication bypass and is never acceptable in production. ' +
      'Remove DEV_USER_ID from production environment variables immediately and redeploy.',
  )
}

// Internal client for bearer token auth in getCurrentUserId — not exported
const supabase = isConfigured
  ? createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null

export type TypedSupabaseClient = SupabaseClient<Database>

export function createServerClient(): TypedSupabaseClient | null {
  if (!supabaseServiceKey || !supabaseUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL: SUPABASE_SERVICE_KEY or SUPABASE_URL not set in production. All database operations will fail.',
      )
    }
    logger.warn('SUPABASE_SERVICE_KEY not set - database features disabled (dev mode)')
    return null
  }
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function dbNotConfigured() {
  return NextResponse.json({ success: false, message: 'Database not configured' }, { status: 503 })
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 401,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  IMPROVED ERROR HANDLING FOR MISSING SUPABASE CONFIGURATION               ║
 * ║  This version explicitly checks for Supabase configuration early and       ║
 * ║  returns 503 (Service Unavailable) instead of 500 (Internal Server Error)  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

export async function getCurrentUserId(
  authHeader?: string | null,
  cookieHeader?: string | null,
  request?: NextRequest | null,
): Promise<string> {
  // ✅ IMPROVED: Check Supabase configuration first
  if (!supabaseUrl || !supabaseAnonKey) {
    logger.error('Supabase not configured - missing environment variables', {
      supabaseUrl: supabaseUrl ? 'set' : 'missing',
      supabaseAnonKey: supabaseAnonKey ? 'set' : 'missing',
    })
    throw new AuthError('Supabase not configured. Please set environment variables.', 503)
  }

  // DEV MODE: Allow development users without full auth — NEVER active in production
  // Defense in depth — checks NODE_ENV + VERCEL_ENV. Module-level fail-fast guard
  // is enforced at the bottom of this file to refuse boot if misconfigured.
  const devUserId = process.env.DEV_USER_ID
  const isProductionRuntime =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (devUserId && !isProductionRuntime && !authHeader && !cookieHeader?.includes('sb-')) {
    logger.info('[auth] Using DEV_USER_ID', { devUserId })
    return devUserId
  }

  // 1. Try Bearer token from Authorization header (priority)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim()
    if (supabase) {
      const { data, error } = await supabase.auth.getUser(token)
      if (!error && data.user) return data.user.id
      // Bearer token was provided but invalid - don't fall through to cookies
      throw new AuthError('Invalid or expired token', 401)
    }
  }

  // 2. Try cookie-based auth only if no Bearer token was provided
  if (!authHeader && cookieHeader && supabaseUrl && supabaseAnonKey) {
    try {
      // Parse the cookie header string into name/value pairs
      const cookies = cookieHeader
        .split(';')
        .map((c) => {
          const [name, ...rest] = c.trim().split('=')
          return { name: name || '', value: rest.join('=') || '' }
        })
        .filter((c) => c.name)

      const ssrClient = createSSRClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return cookies
          },
          setAll() {
            // No-op in API routes — we only read cookies here
          },
        },
      })

      const { data, error } = await ssrClient.auth.getUser()
      if (!error && data.user) return data.user.id
    } catch (e) {
      logger.warn('[auth] Cookie-based auth failed', { error: e instanceof Error ? e.message : e })
    }
  }

  // Fallback to dev user in development mode — NEVER active in production.
  // Mirrors the isProductionRuntime guard on the earlier dev branch (defense in depth).
  if (devUserId && !isProductionRuntime) {
    logger.info('[auth] Falling back to DEV_USER_ID', { devUserId })
    return devUserId
  }

  throw new AuthError('Missing or invalid authentication', 401)
}
