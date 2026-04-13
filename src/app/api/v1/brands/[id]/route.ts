import { type NextRequest, NextResponse } from 'next/server'
import { hashApiKey, rateLimitCheck, getRateLimitResetAt } from '@/lib/services/public-api'
import { createServerClient } from '@/lib/supabase'

const BRAND_COLS =
  'id, user_id, name, slug, description, domain, aliases, domains, competitors, industry, language, color, logo_url, is_active, created_at, updated_at'

async function verifyApiKey(apiKey: string): Promise<string | null> {
  const keyHash = hashApiKey(apiKey)
  const db = createServerClient()
  if (!db) return null

  const { data, error } = await db
    .from('user_api_keys')
    .select('user_id, is_active')
    .eq('encrypted_key', keyHash)
    .eq('is_active', true)
    .single()

  if (error || !data) return null
  return data.user_id
}

function successResponse(data: unknown) {
  return NextResponse.json({ success: true, data, timestamp: Date.now() })
}

function errorResponse(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function rateLimitResponse(key: string) {
  const retryAfter = Math.ceil((getRateLimitResetAt(key) - Date.now()) / 1000)
  return NextResponse.json(
    { success: false, error: 'Rate limit exceeded' },
    { status: 429, headers: { 'Retry-After': String(retryAfter), 'X-RateLimit-Remaining': '0' } },
  )
}

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Params) {
  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey) return errorResponse('Missing X-API-Key header', 401)

  const userId = await verifyApiKey(apiKey)
  if (!userId) return errorResponse('Invalid API key', 401)

  if (!rateLimitCheck(userId)) return rateLimitResponse(userId)

  const { id } = await params
  const db = createServerClient()
  if (!db) return errorResponse('Database not configured', 503)

  const { data, error } = await db
    .from('brands')
    .select(BRAND_COLS)
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error || !data) return errorResponse('Brand not found', 404)
  return successResponse(data)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey) return errorResponse('Missing X-API-Key header', 401)

  const userId = await verifyApiKey(apiKey)
  if (!userId) return errorResponse('Invalid API key', 401)

  if (!rateLimitCheck(userId)) return rateLimitResponse(userId)

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const db = createServerClient()
  if (!db) return errorResponse('Database not configured', 503)

  const { data, error } = await db
    .from('brands')
    .update(body as Record<string, unknown>)
    .eq('id', id)
    .eq('user_id', userId)
    .select(BRAND_COLS)
    .single()

  if (error) {
    if (error.code === '23505') return errorResponse('A brand with this name already exists', 409)
    return errorResponse(error.message)
  }
  if (!data) return errorResponse('Brand not found', 404)
  return successResponse(data)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey) return errorResponse('Missing X-API-Key header', 401)

  const userId = await verifyApiKey(apiKey)
  if (!userId) return errorResponse('Invalid API key', 401)

  if (!rateLimitCheck(userId)) return rateLimitResponse(userId)

  const { id } = await params
  const db = createServerClient()
  if (!db) return errorResponse('Database not configured', 503)

  const { error } = await db.from('brands').delete().eq('id', id).eq('user_id', userId)

  if (error) return errorResponse(error.message)
  return successResponse({ deleted: true })
}
