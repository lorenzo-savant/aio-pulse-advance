import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { formatValidationError } from '@/lib/format-validation-error'

/**
 * Mask an address for display to a token holder who may not be the intended
 * recipient: keep the first character and the full domain, hide the rest.
 * `rebecca@savantmedia.se` → `r••••••@savantmedia.se`
 *
 * The domain stays visible on purpose — it is what lets the real recipient
 * recognise which of their accounts to use, and it is already implied by the
 * workspace they were invited to.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 1) return '•••'
  const local = email.slice(0, at)
  const domain = email.slice(at)
  if (local.length <= 1) return `${local}${'•'.repeat(3)}${domain}`
  return `${local[0]}${'•'.repeat(Math.min(local.length - 1, 8))}${domain}`
}

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

const acceptSchema = z.object({
  // Tokens are 32-byte hex (crypto.randomBytes(32).toString('hex') = 64 chars).
  token: z
    .string()
    .min(32)
    .max(128)
    .regex(/^[A-Fa-f0-9]+$/, 'Malformed token'),
})

export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`invitations-accept:${ip}`, 10, 60_000)
  if (!rateCheck.success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
      },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const parsed = acceptSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: formatValidationError(parsed.error),
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    )
  }

  const { token } = parsed.data

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { data: invitation, error: inviteError } = await db
    .from('brand_invitations')
    .select('*')
    .eq('token', token)
    .single()

  if (inviteError || !invitation) {
    return err('Invalid or expired invitation', 404)
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return err('Invitation has expired', 400)
  }

  // Invitation must still be pending (not already accepted/revoked) — reject
  // replay of a previously-consumed token.
  if (invitation.status && invitation.status !== 'pending') {
    return err('Invitation is no longer valid', 400)
  }

  // The authenticated account's email MUST match the invited email — prevents
  // any logged-in user who obtains a token from binding it to their account.
  const { data: authUser } = await db.auth.admin.getUserById(userId)
  const callerEmail = authUser?.user?.email?.toLowerCase() ?? null
  if (!callerEmail || callerEmail !== String(invitation.email).toLowerCase()) {
    logger.warn('Invitation email mismatch', { source: 'invitations' })
    // Name both sides, or the recipient has no way to act on the refusal —
    // the common case is simply being signed in as the wrong account. The
    // invited address is MASKED: whoever holds this token may not be the
    // intended recipient (a forwarded email, a shared link), so the full
    // address must not be disclosed to them.
    return err(
      `This invitation was issued for ${maskEmail(String(invitation.email))}, ` +
        `but you are signed in as ${callerEmail ?? 'an unknown account'}. ` +
        `Sign out and sign in with the invited address, then open the link again.`,
      403,
    )
  }

  const { data: brand } = await db
    .from('brands')
    .select('id, name, user_id')
    .eq('id', invitation.brand_id)
    .single()

  if (!brand) {
    return err('Brand no longer exists', 404)
  }

  const { data: existingMember } = await db
    .from('team_members')
    .select('id')
    .eq('brand_id', invitation.brand_id)
    .eq('user_id', userId)
    .single()

  if (existingMember) {
    return err('You are already a team member', 400)
  }

  // Atomically claim the invitation: only one concurrent request can flip
  // pending→accepted. If no row comes back, the token was already consumed.
  const { data: claimed, error: claimError } = await db
    .from('brand_invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (claimError) {
    logger.error('Failed to claim invitation', {
      source: 'invitations',
      error: String(claimError),
    })
    return err('Failed to accept invitation')
  }
  if (!claimed) {
    return err('Invitation is no longer valid', 400)
  }

  const { error: memberError } = await db.from('team_members').insert({
    brand_id: invitation.brand_id,
    user_id: userId,
    email: invitation.email,
    role: invitation.role,
    invited_by: invitation.invited_by,
    status: 'active',
  })

  if (memberError) {
    // Roll back the claim so the (valid) invitation can be retried.
    await db
      .from('brand_invitations')
      .update({ status: 'pending', accepted_at: null })
      .eq('id', invitation.id)
    logger.error('Failed to add team member after claim', {
      source: 'invitations',
      error: String(memberError),
    })
    return err('Failed to accept invitation')
  }

  return NextResponse.json({
    success: true,
    message: `You have joined ${brand.name} as ${invitation.role}`,
  })
}
