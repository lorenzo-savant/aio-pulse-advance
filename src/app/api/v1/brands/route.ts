import { type NextRequest, NextResponse } from 'next/server'
import { hashApiKey, publicApiRateLimit } from '@/lib/services/public-api'
import { createServerClient } from '@/lib/supabase'
import { publicBrandCreateSchema, firstZodMessage } from '@/lib/validations'

const BRAND_LIST_COLS =
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

function rateLimitResponse(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  return NextResponse.json(
    { success: false, error: 'Rate limit exceeded' },
    { status: 429, headers: { 'Retry-After': String(retryAfter), 'X-RateLimit-Remaining': '0' } },
  )
}

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey) return errorResponse('Missing X-API-Key header', 401)

  const userId = await verifyApiKey(apiKey)
  if (!userId) return errorResponse('Invalid API key', 401)

  const rl = await publicApiRateLimit(userId)
  if (!rl.success) return rateLimitResponse(rl.resetAt)

  const db = createServerClient()
  if (!db) return errorResponse('Database not configured', 503)

  const { data, error } = await db
    .from('brands')
    .select(BRAND_LIST_COLS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return errorResponse(error.message)

  return successResponse(data || [])
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey) return errorResponse('Missing X-API-Key header', 401)

  const userId = await verifyApiKey(apiKey)
  if (!userId) return errorResponse('Invalid API key', 401)

  const rl = await publicApiRateLimit(userId)
  if (!rl.success) return rateLimitResponse(rl.resetAt)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  // Runtime-validate the body. Zod strips any non-allowlisted keys (e.g.
  // user_id, id, slug, *_at), so only the columns below ever reach the insert.
  const parsed = publicBrandCreateSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(firstZodMessage(parsed.error), 422)
  }
  const { name, description, domain, aliases, domains, competitors, industry, language, color } =
    parsed.data

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const db = createServerClient()
  if (!db) return errorResponse('Database not configured', 503)

  const { data, error } = await db
    .from('brands')
    .insert({
      user_id: userId,
      name,
      slug,
      description: description ?? null,
      domain: domain ?? null,
      aliases: aliases ?? [],
      domains: domains ?? [],
      competitors: competitors ?? [],
      industry: industry ?? null,
      language: language ?? 'en',
      color: color ?? '#6366f1',
    } as unknown as any)
    .select(BRAND_LIST_COLS)
    .single()

  if (error) {
    if (error.code === '23505') return errorResponse('A brand with this name already exists', 409)
    return errorResponse(error.message)
  }

  return successResponse(data)
}
