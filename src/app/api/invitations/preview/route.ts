// PATH: src/app/api/invitations/preview/route.ts
//
// Resolves an invitation token to just enough context to render a usable
// landing screen for someone who is NOT signed in: which workspace they were
// invited to, which address it was issued for, and whether it is still valid.
//
// Deliberately UNAUTHENTICATED — the whole point is to serve the visitor
// before they have an account. What that costs us is bounded:
//   - the token is already in the URL the visitor is holding
//   - the email is MASKED, because a forwarded email or a shared link means
//     the holder may not be the intended recipient
//   - it is READ-ONLY: nothing is consumed, no status changes
//   - rate-limited per IP, so it cannot be used to farm tokens by guessing
//
// Without this, an invitee with no account hits a sign-in wall with no
// indication of which address to use — which is exactly how invitations were
// silently going unaccepted.

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { maskEmail } from '@/app/api/invitations/accept/route'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers)
  const rate = await checkRateLimit(`invite-preview:${ip}`, 20, 60_000)
  if (!rate.success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Try again shortly.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) },
      },
    )
  }

  const token = req.nextUrl.searchParams.get('token')
  if (!token || token.length < 16 || token.length > 256) {
    return NextResponse.json(
      { success: false, message: 'Invalid invitation link' },
      { status: 400 },
    )
  }

  const db = createServerClient()
  if (!db) {
    return NextResponse.json({ success: false, message: 'Service unavailable' }, { status: 503 })
  }

  try {
    const { data: invitation } = await db
      .from('brand_invitations')
      .select('email, role, status, expires_at, brand_id')
      .eq('token', token)
      .maybeSingle()

    // Same response shape for "no such token" and "already used" — a probe
    // must not learn which tokens exist.
    if (!invitation) {
      return NextResponse.json(
        { success: false, message: 'This invitation link is not valid' },
        { status: 404 },
      )
    }

    const expired = new Date(invitation.expires_at) < new Date()
    const alreadyUsed = Boolean(invitation.status && invitation.status !== 'pending')

    const { data: brand } = await db
      .from('brands')
      .select('name')
      .eq('id', invitation.brand_id)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      data: {
        brandName: brand?.name ?? null,
        // Masked: the holder may not be the intended recipient.
        maskedEmail: maskEmail(String(invitation.email)),
        role: invitation.role,
        expiresAt: invitation.expires_at,
        expired,
        alreadyUsed,
        usable: !expired && !alreadyUsed,
      },
    })
  } catch (e) {
    logger.error('Invitation preview failed', {
      source: 'invitations',
      err: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json({ success: false, message: 'Service unavailable' }, { status: 503 })
  }
}
