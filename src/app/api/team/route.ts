// PATH: src/app/api/team/route.ts
import { formatValidationError } from '@/lib/format-validation-error'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { z } from 'zod'
import { sendInvitationEmail } from '@/lib/services/email'
import { logger } from '@/lib/logger'
import { parsePaginationParams } from '@/lib/api-utils'
import { randomBytes } from 'crypto'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

const inviteSchema = z.object({
  brand_id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['editor', 'viewer']).default('viewer'),
})

// GET /api/team?brand_id=xxx - List team members
export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const { page, limit, offset } = parsePaginationParams(searchParams, {
    defaultLimit: 20,
    maxLimit: 50,
  })

  if (!brandId) {
    return err('brand_id is required', 400)
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // Verify user has access to this brand (owner or team member)
  const { data: brand } = await db.from('brands').select('id, user_id').eq('id', brandId).single()

  if (!brand) {
    return err('Brand not found', 404)
  }

  const isOwner = String(brand.user_id) === userId
  const { data: teamMembership } = await db
    .from('team_members')
    .select('id')
    .eq('brand_id', brandId)
    .eq('user_id', userId)
    .single()

  if (!isOwner && !teamMembership) {
    return err('Access denied', 403)
  }

  // Get team members with user info (no broken join on TEXT user_id)
  const {
    data: members,
    error,
    count,
  } = await db
    .from('team_members')
    .select('id, brand_id, user_id, email, role, status, invited_by, created_at, updated_at', {
      count: 'exact',
    })
    .eq('brand_id', brandId)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    logger.error('/api/team failed', { err: error })
    return err('Failed to load data')
  }

  // Load display names from profiles (best effort)
  let profileMap: Record<string, string> = {}
  if (members && members.length > 0) {
    const userIds = members.map((m: any) => m.user_id).filter(Boolean)
    if (userIds.length > 0) {
      try {
        const { data: profiles } = await db
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds)
        if (profiles) {
          profileMap = Object.fromEntries(
            profiles.map((p: any) => [p.id, p.full_name || p.email || p.id]),
          )
        }
      } catch {
        // non-critical, ignore
      }
    }
  }

  const enrichedMembers = (members || []).map((m: any) => ({
    ...m,
    display_name: profileMap[m.user_id] || m.email,
  }))

  // Get pending invitations (filter by status='pending')
  const { data: invitations } = await db
    .from('brand_invitations')
    .select('*')
    .eq('brand_id', brandId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true })

  return NextResponse.json({
    success: true,
    data: {
      members: enrichedMembers,
      pending_invitations: invitations || [],
    },
    pagination: {
      page,
      perPage: limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / limit),
      hasMore: offset + limit < (count ?? 0),
    },
  })
}

// POST /api/team - Invite a team member
export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const parsed = inviteSchema.safeParse(body)
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

  const { brand_id, email, role } = parsed.data

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // Verify user owns the brand
  const { data: brand } = await db
    .from('brands')
    .select('id, name, user_id')
    .eq('id', brand_id)
    .single()

  if (!brand) return err('Brand not found', 404)
  if (String(brand.user_id) !== userId) return err('Access denied', 403)

  // Check if already a member
  const { data: existingMember } = await db
    .from('team_members')
    .select('id, status')
    .eq('brand_id', brand_id)
    .eq('email', email)
    .single()

  if (existingMember) {
    return err('User is already a team member', 400)
  }

  // Create invitation with token
  const token = randomBytes(32).toString('hex')

  // Create invitation (or update if exists)
  const { data: invitation, error: inviteError } = await db
    .from('brand_invitations')
    .upsert(
      {
        brand_id,
        email,
        role,
        invited_by: userId,
        token, // Add explicit token
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: 'brand_id,email' },
    )
    .select()
    .single()

  if (inviteError) {
    logger.error('Invitation error', { source: 'team', error: String(inviteError) })
    return err('Request failed')
  }

  // Send invitation email
  const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/team/accept?token=${token}`

  // Get inviter's real name from profiles
  let inviterDisplayName = 'A team member'
  try {
    const { data: inviterProfile } = await db
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single()
    if (inviterProfile) {
      inviterDisplayName = inviterProfile.full_name || inviterProfile.email || inviterDisplayName
    }
  } catch {
    // non-critical
  }

  try {
    await sendInvitationEmail({
      to: email,
      brandName: brand?.name || 'AIO Pulse',
      inviterName: inviterDisplayName,
      role: invitation?.role || role,
      acceptUrl,
    })
    logger.info('Invitation sent', { source: 'team', email })
  } catch (emailErr) {
    logger.error('Email error', { source: 'team', error: String(emailErr) })
    // Don't fail the request if email fails
  }

  return NextResponse.json({
    success: true,
    data: invitation,
    message: `Invitation sent to ${email}`,
  })
}

// DELETE /api/team?member_id=xxx - Remove a team member
export async function DELETE(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('member_id')
  const invitationId = searchParams.get('invitation_id')

  if (!memberId && !invitationId) {
    return err('member_id or invitation_id is required', 400)
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // Get the member/invite to check permissions
  if (memberId) {
    const { data: member } = await db
      .from('team_members')
      .select('brand_id, role, user_id')
      .eq('id', memberId)
      .single()

    if (!member) return err('Member not found', 404)

    // Check if user is brand owner
    const { data: brand } = await db
      .from('brands')
      .select('user_id')
      .eq('id', member.brand_id)
      .single()

    if (!brand || String(brand.user_id) !== userId) {
      return err('Access denied', 403)
    }

    // Can't remove owner
    if (member.role === 'owner') {
      return err('Cannot remove the brand owner', 400)
    }

    const { error } = await db.from('team_members').delete().eq('id', memberId)

    if (error) {
      logger.error('/api/team delete member failed', { err: error })
      return err('Request failed')
    }
  }

  if (invitationId) {
    const { data: invite } = await db
      .from('brand_invitations')
      .select('brand_id, invited_by')
      .eq('id', invitationId)
      .single()

    if (!invite) return err('Invitation not found', 404)

    // Only inviter or brand owner can cancel
    const { data: brand } = await db
      .from('brands')
      .select('user_id')
      .eq('id', invite.brand_id)
      .single()

    if (!brand || (String(brand.user_id) !== userId && invite.invited_by !== userId)) {
      return err('Access denied', 403)
    }

    const { error } = await db.from('brand_invitations').delete().eq('id', invitationId)

    if (error) {
      logger.error('/api/team delete invitation failed', { err: error })
      return err('Request failed')
    }
  }

  return NextResponse.json({ success: true, message: 'Removed successfully' })
}

// PATCH /api/team?member_id=xxx - Update member role
export async function PATCH(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('member_id')

  if (!memberId) {
    return err('member_id is required', 400)
  }

  let body: { role?: 'editor' | 'viewer' }
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  if (!body.role || !['editor', 'viewer'].includes(body.role)) {
    return err('Invalid role', 400)
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // Get member and check ownership
  const { data: member } = await db
    .from('team_members')
    .select('brand_id, role')
    .eq('id', memberId)
    .single()

  if (!member) return err('Member not found', 404)

  const { data: brand } = await db
    .from('brands')
    .select('user_id')
    .eq('id', member.brand_id)
    .single()

  if (!brand || String(brand.user_id) !== userId) {
    return err('Access denied', 403)
  }

  // Can't change owner role
  if (member.role === 'owner') {
    return err('Cannot change owner role', 400)
  }

  const { error } = await db
    .from('team_members')
    .update({ role: body.role, updated_at: new Date().toISOString() })
    .eq('id', memberId)

  if (error) {
    logger.error('/api/team update role failed', { err: error })
    return err('Request failed')
  }

  return NextResponse.json({ success: true, message: 'Role updated' })
}
