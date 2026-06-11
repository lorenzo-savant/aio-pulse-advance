import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { firstZodMessage } from '@/lib/validations'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { encryptSecret } from '@/lib/crypto/secret-box'
import { logger } from '@/lib/logger'

const ALLOWED_PROVIDERS = ['openai', 'gemini', 'perplexity', 'anthropic'] as const

const keyCreateSchema = z.object({
  provider: z.enum(ALLOWED_PROVIDERS),
  apiKey: z.string().min(8, 'Invalid API key').max(512, 'Invalid API key'),
  label: z.string().max(120).optional(),
})

const keyPatchSchema = z.object({
  id: z.string().min(1, 'id and isActive required'),
  isActive: z.boolean(),
})

function rateLimited(resetAt: number): NextResponse {
  return NextResponse.json(
    { success: false, message: 'Rate limit exceeded. Try again later.' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)) },
    },
  )
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`keys-get:${ip}`, 30, 60_000)
  if (!rateCheck.success) return rateLimited(rateCheck.resetAt)

  const supabase = createServerClient()
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  // Metadata only — the secret material (encrypted_key) is NEVER returned to the client.
  const { data, error } = await supabase
    .from('user_api_keys')
    .select('id, provider, label, is_active, created_at')
    .eq('user_id', userId)

  if (error) {
    logger.error('keys GET failed', { err: error.message })
    return NextResponse.json(
      { success: false, message: 'Failed to load API keys' },
      { status: 500 },
    )
  }

  const keys = (data || []).map((k: any) => ({ ...k, hasKey: true }))
  return NextResponse.json({ success: true, data: keys })
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`keys-mut:${ip}`, 10, 60_000)
  if (!rateCheck.success) return rateLimited(rateCheck.resetAt)

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = keyCreateSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: firstZodMessage(parsed.error, 'Provider and API key required') },
      { status: 400 },
    )
  }
  const { provider, apiKey, label } = parsed.data

  const supabase = createServerClient()
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  let encryptedKey: string
  try {
    encryptedKey = encryptSecret(apiKey.trim())
  } catch (e) {
    logger.error('keys POST: encryption unavailable', { err: e instanceof Error ? e.message : e })
    return NextResponse.json(
      { success: false, message: 'Key encryption is not configured on the server' },
      { status: 503 },
    )
  }

  const { data: existing } = await supabase
    .from('user_api_keys')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('user_api_keys')
      .update({
        encrypted_key: encryptedKey,
        label: label || provider,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('user_id', userId)
    if (error) {
      logger.error('keys POST update failed', { err: error.message })
      return NextResponse.json(
        { success: false, message: 'Failed to save API key' },
        { status: 500 },
      )
    }
  } else {
    const { error } = await supabase.from('user_api_keys').insert({
      user_id: userId,
      provider,
      encrypted_key: encryptedKey,
      label: label || provider,
      is_active: true,
    })
    if (error) {
      logger.error('keys POST insert failed', { err: error.message })
      return NextResponse.json(
        { success: false, message: 'Failed to save API key' },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ success: true, message: 'API key saved' })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`keys-mut:${ip}`, 10, 60_000)
  if (!rateCheck.success) return rateLimited(rateCheck.resetAt)

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = keyPatchSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: firstZodMessage(parsed.error, 'id and isActive required') },
      { status: 400 },
    )
  }
  const { id, isActive } = parsed.data

  const supabase = createServerClient()
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  const { error } = await supabase
    .from('user_api_keys')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    logger.error('keys PATCH failed', { err: error.message })
    return NextResponse.json(
      { success: false, message: 'Failed to update API key' },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true, message: 'API key updated' })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

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

  const { error } = await supabase.from('user_api_keys').delete().eq('id', id).eq('user_id', userId)

  if (error) {
    logger.error('keys DELETE failed', { err: error.message })
    return NextResponse.json(
      { success: false, message: 'Failed to delete API key' },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true, message: 'API key deleted' })
}
