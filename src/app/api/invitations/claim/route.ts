// PATH: src/app/api/invitations/claim/route.ts
//
// Claims every pending invitation addressed to the SIGNED-IN user's verified
// email — no token required.
//
// Why this exists: the token round-trip is fragile by construction. An invitee
// with no account goes register → confirm email → sign in, and the
// confirmation link routinely opens a new tab, a different browser, or a
// different device (registered on a laptop, mail read on a phone). Any browser
// storage loses the token at that point, and the invitee lands on the
// dashboard as a non-member with nothing to click. That is exactly how a real
// invitation ended up sitting `pending` next to a freshly created account.
//
// Is dropping the token safe? The token proves the holder received the email.
// This route proves something stronger: Supabase has VERIFIED the caller
// controls that address, and the caller is authenticated. A forwarded link
// cannot be claimed by the wrong person here, because the match is on the
// verified address rather than on possession of a secret. The token path stays
// for the direct-click flow; this is the recovery path.
//
// Deliberately narrow: only `pending`, only unexpired, only exact
// case-insensitive address matches, and it never touches invitations for
// anyone else.

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/ratelimit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface ClaimedInvite {
  brandId: string
  brandName: string | null
  role: string
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const rl = await checkRateLimit(`invite-claim:${userId}`, 10, 60_000)
  if (!rl.success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Try again shortly.' },
      { status: 429 },
    )
  }

  const db = createServerClient()
  if (!db) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  try {
    const { data: authUser } = await db.auth.admin.getUserById(userId)
    const email = authUser?.user?.email?.toLowerCase()

    // An unverified address proves nothing — that is the whole basis for
    // matching without a token, so refuse rather than weaken it.
    if (!email || !authUser?.user?.email_confirmed_at) {
      return NextResponse.json({ success: true, data: { claimed: [] } })
    }

    const { data: invitations } = await db
      .from('brand_invitations')
      .select('id, brand_id, role, email, expires_at')
      .ilike('email', email)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())

    if (!invitations || invitations.length === 0) {
      return NextResponse.json({ success: true, data: { claimed: [] } })
    }

    const claimed: ClaimedInvite[] = []

    for (const invitation of invitations) {
      // Belt and braces: ilike is case-insensitive but not anchored in every
      // Postgres collation setup, so re-check the exact address.
      if (String(invitation.email).toLowerCase() !== email) continue

      const { data: already } = await db
        .from('team_members')
        .select('id')
        .eq('brand_id', invitation.brand_id)
        .eq('user_id', userId)
        .maybeSingle()

      if (already) {
        // Membership exists but the invitation was left pending — reconcile it
        // so it stops being offered.
        await db
          .from('brand_invitations')
          .update({ status: 'accepted', accepted_at: new Date().toISOString() })
          .eq('id', invitation.id)
          .eq('status', 'pending')
        continue
      }

      // Atomic flip: only one concurrent request can move pending→accepted.
      const { data: won } = await db
        .from('brand_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invitation.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()

      if (!won) continue // someone else claimed it first

      const { error: memberError } = await db.from('team_members').insert({
        brand_id: invitation.brand_id,
        user_id: userId,
        email: invitation.email,
        role: invitation.role,
        invited_by: userId,
        // See the note in accept/route.ts: the CHECK constraint only permits
        // 'pending' | 'accepted' | 'declined'. 'active' is rejected.
        status: 'accepted',
      })

      if (memberError) {
        // Put the invitation back so the claim can be retried — never leave it
        // consumed without a membership to show for it.
        await db
          .from('brand_invitations')
          .update({ status: 'pending', accepted_at: null })
          .eq('id', invitation.id)
        logger.error('Failed to create membership while claiming invitation', {
          source: 'invitations',
          error: memberError.message,
          code: memberError.code,
          brandId: invitation.brand_id,
        })
        continue
      }

      const { data: brand } = await db
        .from('brands')
        .select('name')
        .eq('id', invitation.brand_id)
        .maybeSingle()

      claimed.push({
        brandId: invitation.brand_id,
        brandName: brand?.name ?? null,
        role: invitation.role,
      })
    }

    if (claimed.length > 0) {
      logger.info('Pending invitations claimed by verified email', {
        source: 'invitations',
        count: claimed.length,
      })
    }

    return NextResponse.json({ success: true, data: { claimed } })
  } catch (e) {
    logger.error('Invitation claim failed', {
      source: 'invitations',
      err: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json(
      { success: false, message: 'Failed to claim invitations' },
      { status: 500 },
    )
  }
}
