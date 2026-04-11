// PATH: src/app/api/keys/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 401 })
  }

  const supabase = createServerClient()
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  const { data, error } = await supabase
    .from('user_api_keys')
    .select('id, provider, label, is_active, created_at')
    .eq('user_id', userId)

  if (error) throw error

  const keys = (data || []).map((k: any) => ({
    ...k,
    hasKey: true,
  }))

  return NextResponse.json({ success: true, data: keys })
}

export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { provider, apiKey, label } = body as { provider?: string; apiKey?: string; label?: string }

  if (!provider || !apiKey) {
    return NextResponse.json(
      { success: false, message: 'Provider and API key required' },
      { status: 400 },
    )
  }

  const supabase = createServerClient()
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  // Check if key exists for this provider
  const { data: existing } = await supabase
    .from('user_api_keys')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single()

  if (existing) {
    // Update existing key
    const { error } = await supabase
      .from('user_api_keys')
      .update({
        encrypted_key: apiKey,
        label: label || provider,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (error) throw error
  } else {
    // Insert new key
    const { error } = await supabase.from('user_api_keys').insert({
      user_id: userId,
      provider,
      encrypted_key: apiKey,
      label: label || provider,
      is_active: true,
    })

    if (error) throw error
  }

  return NextResponse.json({ success: true, message: 'API key saved' })
}

export async function DELETE(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ success: false, message: 'Key ID required' }, { status: 400 })
  }

  const supabase = createServerClient()
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  // Verify the key belongs to this user before deleting (IDOR prevention)
  const { data: key } = await supabase
    .from('user_api_keys')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!key) {
    return NextResponse.json(
      { success: false, message: 'Key not found or access denied' },
      { status: 404 },
    )
  }

  const { error } = await supabase.from('user_api_keys').delete().eq('id', id)

  if (error) throw error

  return NextResponse.json({ success: true, message: 'API key deleted' })
}
