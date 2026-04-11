// PATH: src/app/api/prompts/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { parsePaginationParams, paginatedResponse } from '@/lib/api-utils'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'

const PROMPT_RATE_LIMIT = 50

// ─── Validation ───────────────────────────────────────────────────────────────

const promptSchema = z.object({
  brand_id: z.string().uuid(),
  text: z.string().min(5).max(500),
  language: z.string().default('en'),
  market: z.string().default('global'),
  category: z.enum(['awareness', 'comparison', 'alternative', 'features', 'custom']).optional(),
  engines: z
    .array(z.enum(['chatgpt', 'gemini', 'perplexity', 'claude']))
    .min(1)
    .default(['chatgpt', 'gemini', 'perplexity']),
  run_frequency: z.enum(['hourly', 'daily', 'weekly']).default('daily'),
})

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// ─── GET /api/prompts ─────────────────────────────────────────────────────────
// Returns prompts for the authenticated user.
// ?brand_id=uuid  → filter by brand
// ?page=1&limit=20 → pagination
export async function GET(req: NextRequest) {
  const identifier = getClientIp(req.headers)
  const { success, remaining, resetAt } = await checkRateLimit(identifier, PROMPT_RATE_LIMIT)

  const response = await getPromptsHandler(req)

  response.headers.set('X-RateLimit-Limit', String(PROMPT_RATE_LIMIT))
  response.headers.set('X-RateLimit-Remaining', String(remaining))
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))

  if (!success) {
    return NextResponse.json(
      {
        success: false,
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
      },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)) } },
    )
  }

  return response
}

async function getPromptsHandler(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const { page, limit, offset } = parsePaginationParams(searchParams, {
    defaultLimit: 20,
    maxLimit: 100,
  })

  let query = db
    .from('prompts')
    .select('*, brand:brands(name, color, slug)', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (brandId) query = query.eq('brand_id', brandId)

  const { data, error, count } = await query
  if (error) return err(error.message)

  return NextResponse.json({
    success: true,
    ...paginatedResponse(data || [], count, page, limit),
    timestamp: Date.now(),
  })
}

// ─── POST /api/prompts ────────────────────────────────────────────────────────
// Creates a new prompt.
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

  const parsed = promptSchema.safeParse(body)
  if (!parsed.success) {
    console.log('[prompts] Validation failed:', JSON.stringify(parsed.error.flatten().fieldErrors))
    return NextResponse.json(
      {
        success: false,
        message: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    )
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // Verify that the referenced brand belongs to this user
  const { data: brand } = await db
    .from('brands')
    .select('id')
    .eq('id', parsed.data.brand_id)
    .eq('user_id', userId)
    .single()

  if (!brand) return err('Brand not found or access denied', 404)

  // Insert prompt - user_id must be UUID
  const { data, error } = await db
    .from('prompts')
    .insert({ ...parsed.data, user_id: userId })
    .select()
    .single()

  if (error) {
    console.error('[prompts] Insert error:', error)
    return err(error.message)
  }
  return NextResponse.json({ success: true, data, timestamp: Date.now() }, { status: 201 })
}

// ─── DELETE /api/prompts ──────────────────────────────────────────────────────
// ?id=uuid → deletes the prompt
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
  const id = searchParams.get('id')
  if (!id) return err('id query parameter is required', 400)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { error } = await db.from('prompts').delete().eq('id', id).eq('user_id', userId)

  if (error) return err(error.message)
  return NextResponse.json({ success: true, data: null, timestamp: Date.now() })
}
