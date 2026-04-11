import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient as createSSRClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/types/database'

const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
const supabaseServiceKey = process.env['SUPABASE_SERVICE_KEY']

const isConfigured = !!supabaseUrl && !!supabaseAnonKey

if (!isConfigured && process.env.NODE_ENV === 'production') {
  throw new Error(
    'FATAL: Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) are missing in production. Aborting.',
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
    console.warn('⚠️ SUPABASE_SERVICE_KEY not set - database features disabled (dev mode)')
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
    console.error('❌ Supabase not configured - missing environment variables:')
    console.error('   - NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
    console.error('   - NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓' : '✗')
    throw new AuthError('Supabase not configured. Please set environment variables.', 503)
  }

  // DEV MODE: Allow development users without full auth — NEVER active in production
  const devUserId = process.env.DEV_USER_ID
  if (
    devUserId &&
    process.env.NODE_ENV !== 'production' &&
    !authHeader &&
    !cookieHeader?.includes('sb-')
  ) {
    console.log('[auth] Using DEV_USER_ID:', devUserId)
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
      console.warn('[auth] Cookie-based auth failed:', e instanceof Error ? e.message : e)
    }
  }

  // Fallback to dev user in development mode
  if (devUserId) {
    console.log('[auth] Falling back to DEV_USER_ID:', devUserId)
    return devUserId
  }

  throw new AuthError('Missing or invalid authentication', 401)
}
