import { NextResponse } from 'next/server'
import { createServerClient as createSSRServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  // Server-only secrets — NOT prefixed NEXT_PUBLIC_, so they are never inlined
  // into the client bundle. This route is the only reader and is hard-blocked
  // in production above.
  const demoEmail = process.env.DEMO_EMAIL
  const demoPassword = process.env.DEMO_PASSWORD

  if (!demoEmail || !demoPassword) {
    return NextResponse.json(
      {
        error: 'Set DEMO_EMAIL and DEMO_PASSWORD in .env.local',
      },
      { status: 400 },
    )
  }

  const adminClient = createServerClient()
  if (!adminClient) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const { error: createError } = await adminClient.auth.admin.createUser({
    email: demoEmail,
    password: demoPassword,
    email_confirm: true,
  })

  if (createError && createError.message.includes('already')) {
    const { data: users } = await adminClient.auth.admin.listUsers()
    const existing = users?.users.find((u) => u.email === demoEmail)
    if (existing) {
      const { error: updateError } = await adminClient.auth.admin.updateUserById(existing.id, {
        password: demoPassword,
      })
      if (updateError) {
        logger.error('dev-login: failed to update password', { error: updateError.message })
      }
    }
  } else if (createError) {
    logger.error('dev-login: failed to create user', { error: createError.message })
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  const cookieStore = await cookies()
  const ssrClient = createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    },
  )

  const { error: signInError } = await ssrClient.auth.signInWithPassword({
    email: demoEmail,
    password: demoPassword,
  })

  if (signInError) {
    logger.error('dev-login: sign in failed', { error: signInError.message })
    return NextResponse.json({ error: signInError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, redirectTo: '/dashboard' })
}
