import { type NextRequest, NextResponse } from 'next/server'
import { verifyApiKey, publicApiRateLimit } from '@/lib/services/public-api'
import { createServerClient } from '@/lib/supabase'
import { parsePaginationParams, getPaginationHeaders } from '@/lib/api-utils'
import { publicBrandCreateSchema, firstZodMessage } from '@/lib/validations'
import { getAccessibleBrandIds } from '@/lib/authorize'

const BRAND_LIST_COLS =
  'id, user_id, name, slug, description, domain, aliases, domains, competitors, industry, language, color, logo_url, is_active, created_at, updated_at'

// Safety ceiling for the un-paginated legacy response. High enough that no
// real account hits it today, low enough that the response cannot grow
// without bound. Truncation is signalled via X-Pagination-Truncated.
const HARD_MAX_BRANDS = 1000

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

  // Pagination is OPT-IN. An earlier revision made it the default (limit 50),
  // which silently truncated `data` for any integrator with more brands than
  // that — HTTP 200, no error, 70 rows just missing. `data` was previously
  // complete, so capping it by default is a breaking contract change however
  // "additive" the extra `pagination` object looks.
  //
  // Callers that pass `page` or `limit` get a bounded, paginated response
  // plus X-Pagination-* headers. Callers that pass neither keep the historical
  // full list, with a safety ceiling so the response cannot grow unbounded.
  const { searchParams } = new URL(req.url)
  const paginationRequested = searchParams.has('page') || searchParams.has('limit')

  const { page, limit, offset } = parsePaginationParams(searchParams, {
    defaultLimit: HARD_MAX_BRANDS,
    maxLimit: HARD_MAX_BRANDS,
  })

  // Same scope as the app: owned brands plus the ones the caller collaborates
  // on. An integrator's key should see the same projects its owner does.
  const accessibleBrandIds = await getAccessibleBrandIds(db, userId)

  // Empty scope is a real answer (the key has no brands), not an error to push
  // through PostgREST's `.in()` serialization.
  if (accessibleBrandIds.length === 0) {
    return paginationRequested
      ? NextResponse.json(
          {
            success: true,
            data: [],
            pagination: { page, perPage: limit, total: 0, totalPages: 0, hasMore: false },
            timestamp: Date.now(),
          },
          { headers: getPaginationHeaders(0, page, limit) },
        )
      : successResponse([])
  }

  let query = db
    .from('brands')
    .select(BRAND_LIST_COLS, { count: 'exact' })
    .in('id', accessibleBrandIds)
    .order('created_at', { ascending: false })

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) return errorResponse(error.message)

  const rows = data || []
  const total = count ?? rows.length

  if (!paginationRequested) {
    // Legacy shape, unchanged. Warn in the headers if the safety ceiling
    // actually truncated — silence here is what makes truncation dangerous.
    const headers = getPaginationHeaders(total, 1, HARD_MAX_BRANDS)
    if (total > rows.length) {
      headers['X-Pagination-Truncated'] = 'true'
    }
    return NextResponse.json({ success: true, data: rows, timestamp: Date.now() }, { headers })
  }

  return NextResponse.json(
    {
      success: true,
      data: rows,
      pagination: {
        page,
        perPage: limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
      timestamp: Date.now(),
    },
    { headers: getPaginationHeaders(total, page, limit) },
  )
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
