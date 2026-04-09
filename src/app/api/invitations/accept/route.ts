import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { z } from 'zod'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

const acceptSchema = z.object({
  token: z.string(),
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const parsed = acceptSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { token } = parsed.data

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { data: invitation, error: inviteError } = await (db as any)
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

  const { data: brand } = await (db as any)
    .from('brands')
    .select('id, name, user_id')
    .eq('id', invitation.brand_id)
    .single()

  if (!brand) {
    return err('Brand no longer exists', 404)
  }

  const { data: existingMember } = await (db as any)
    .from('team_members')
    .select('id')
    .eq('brand_id', invitation.brand_id)
    .eq('user_id', userId)
    .single()

  if (existingMember) {
    return err('You are already a team member', 400)
  }

  const { error: memberError } = await (db as any).from('team_members').insert({
    brand_id: invitation.brand_id,
    user_id: userId,
    email: invitation.email,
    role: invitation.role,
    invited_by: invitation.invited_by,
    status: 'active',
  })

  if (memberError) return err(memberError.message)

  const { error: updateError } = await (db as any)
    .from('brand_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invitation.id)

  if (updateError) {
    console.error('Failed to update invitation status:', updateError)
    // Fallback: try to delete if update fails
    await (db as any).from('brand_invitations').delete().eq('id', invitation.id)
  }

  return NextResponse.json({
    success: true,
    message: `You have joined ${brand.name} as ${invitation.role}`,
  })
}
