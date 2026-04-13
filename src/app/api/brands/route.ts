// PATH: src/app/api/brands/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUserId, AuthError, dbNotConfigured } from '@/lib/supabase'
import { slugify } from '@/lib/utils'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { logger } from '@/lib/logger'

// ─── Validation ───────────────────────────────────────────────────────────────

const brandSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  domain: z.string().max(200).optional(),
  aliases: z.array(z.string().max(100)).max(10).optional().default([]),
  domains: z.array(z.string().max(200)).max(20).optional().default([]),
  competitors: z.array(z.string().max(100)).max(20).optional().default([]),
  industry: z.string().max(100).optional(),
  // Accept empty string from dropdowns with a default placeholder option
  language: z
    .preprocess((v) => (v === '' || v == null ? 'en' : v), z.enum(['en', 'it', 'sv']))
    .optional()
    .default('en'),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color')
    .optional()
    .default('#6366f1'),
})

// Safe columns that always exist — avoid report_* to prevent schema cache errors
const BRAND_LIST_COLS =
  'id, user_id, name, slug, description, domain, aliases, domains, competitors, industry, language, color, logo_url, is_active, created_at, updated_at'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

async function getUserBrandIds(db: any, userId: string): Promise<string[]> {
  // Get brands owned by user
  const { data: ownedBrands } = await db.from('brands').select('id').eq('user_id', userId)

  const ownedIds = (ownedBrands || []).map((b: any) => b.id)

  // Get brands where user is a team member
  const { data: teamMemberships } = await db
    .from('team_members')
    .select('brand_id')
    .eq('user_id', userId)
    .eq('status', 'accepted')

  const teamIds = (teamMemberships || []).map((m: any) => m.brand_id)

  // Return combined list
  return [...ownedIds, ...teamIds]
}

async function canEditBrand(db: any, brandId: string, userId: string): Promise<boolean> {
  // Check if user owns the brand
  const { data: brand } = await db.from('brands').select('user_id').eq('id', brandId).single()

  if (String(brand?.user_id) === userId) return true

  // Check if user is an editor/owner on the team
  const { data: membership } = await db
    .from('team_members')
    .select('role')
    .eq('brand_id', brandId)
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .in('role', ['owner', 'editor'])
    .single()

  return !!membership
}

// ─── GET /api/brands ──────────────────────────────────────────────────────────
// Returns all brands belonging to the authenticated user.
export async function GET(req: NextRequest) {
  try {
    let userId: string
    try {
      userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
    } catch (e) {
      if (e instanceof AuthError)
        return NextResponse.json({ success: false, message: e.message }, { status: 401 })
      return err('Authentication failed')
    }

    const ip = getClientIp(req.headers)
    const rateCheck = await checkRateLimit(`brands-get:${ip}`, 30, 60_000)
    if (!rateCheck.success) {
      return NextResponse.json(
        { success: false, message: 'Rate limit exceeded. Try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
        },
      )
    }

    const db = createServerClient()

    // If no database configured, return empty array (dev mode without DB)
    if (!db) {
      logger.warn('No database configured, returning empty array', { route: '/api/brands' })
      return NextResponse.json({ success: true, data: [], timestamp: Date.now() })
    }

    // Get brands user owns + brands they're team member of
    const brandIds = await getUserBrandIds(db, userId)

    if (brandIds.length === 0) {
      return NextResponse.json({ success: true, data: [], timestamp: Date.now() })
    }

    const { data, error } = await db
      .from('brands')
      .select(BRAND_LIST_COLS)
      .in('id', brandIds)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Database error', { route: '/api/brands', error })
      return err(error.message)
    }

    return NextResponse.json({ success: true, data, timestamp: Date.now() })
  } catch (e) {
    logger.error('GET error', { route: '/api/brands', error: e })
    return err(e instanceof Error ? e.message : 'Internal server error')
  }
}

// ─── POST /api/brands ─────────────────────────────────────────────────────────
// Creates a new brand.
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
  const rateCheck = await checkRateLimit(`brands-post:${ip}`, 10, 60_000)
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

  const parsed = brandSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    )
  }

  const slug = slugify(parsed.data.name)
  const db = createServerClient()

  if (!db) {
    return err('Database not configured', 503)
  }

  const { data, error } = await db
    .from('brands')
    .insert({ ...parsed.data, user_id: userId, slug })
    .select(BRAND_LIST_COLS)
    .single()

  if (error) {
    // Supabase returns 23505 for unique constraint violations (duplicate slug)
    if (error.code === '23505') {
      return err('A brand with this name already exists', 409)
    }
    return err(error.message)
  }

  return NextResponse.json({ success: true, data, timestamp: Date.now() }, { status: 201 })
}
