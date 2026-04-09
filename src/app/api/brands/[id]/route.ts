// PATH: src/app/api/brands/[id]/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'

// ─── Validation ───────────────────────────────────────────────────────────────

const updateBrandSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  domain: z.string().max(200).optional().nullable(),
  aliases: z.array(z.string().max(100)).max(10).optional(),
  domains: z.array(z.string().max(200)).max(20).optional(),
  competitors: z.array(z.string().max(100)).max(20).optional(),
  industry: z.string().max(100).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  is_active: z.boolean().optional(),
  // White-label settings
  report_brand_name: z.string().max(100).optional().nullable(),
  report_primary_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  report_logo_url: z.string().url().max(500).optional().nullable(),
})

// Explicit column list — try full list first, fallback to safe list
const BRAND_ALL_COLS =
  'id, user_id, name, slug, description, domain, aliases, domains, competitors, industry, color, logo_url, is_active, created_at, updated_at, report_logo_url, report_brand_name, report_primary_color'
const BRAND_SAFE_COLS =
  'id, user_id, name, slug, description, domain, aliases, domains, competitors, industry, color, logo_url, is_active, created_at, updated_at'

interface Params {
  params: Promise<{ id: string }>
}

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

/**
 * Try to select with report columns, fallback to safe columns if schema cache error.
 */
async function selectBrand(db: any, id: string, userId: string) {
  const { data, error } = await db
    .from('brands')
    .select(BRAND_ALL_COLS)
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error && error.message?.includes('schema cache')) {
    // Fallback: select without report_* columns
    const fallback = await db
      .from('brands')
      .select(BRAND_SAFE_COLS)
      .eq('id', id)
      .eq('user_id', userId)
      .single()
    return fallback
  }

  return { data, error }
}

// ─── GET /api/brands/[id] ─────────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
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

  const { data, error } = await selectBrand(db, id, userId)

  if (error || !data) return err('Brand not found', 404)
  return NextResponse.json({ success: true, data, timestamp: Date.now() })
}

// ─── PUT /api/brands/[id] ─────────────────────────────────────────────────────
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
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

  const parsed = updateBrandSchema.safeParse(body)
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

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)
  const { data, error } = await db
    .from('brands')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', userId)
    .select(BRAND_ALL_COLS)
    .single()

  if (error) {
    // If schema cache error on report columns, try without them
    if (error.message?.includes('schema cache')) {
      const fallback = await db
        .from('brands')
        .update(parsed.data)
        .eq('id', id)
        .eq('user_id', userId)
        .select(BRAND_SAFE_COLS)
        .single()
      if (fallback.error) return err(fallback.error.message)
      if (!fallback.data) return err('Brand not found', 404)
      return NextResponse.json({ success: true, data: fallback.data, timestamp: Date.now() })
    }
    return err(error.message)
  }
  if (!data) return err('Brand not found', 404)
  return NextResponse.json({ success: true, data, timestamp: Date.now() })
}

// ─── PATCH /api/brands/[id] ───────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
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

  const parsed = updateBrandSchema.safeParse(body)
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

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // Filter out undefined values for partial update
  const updateData = Object.fromEntries(
    Object.entries(parsed.data).filter(([_, v]) => v !== undefined),
  )

  const { data, error } = await db
    .from('brands')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', userId)
    .select(BRAND_ALL_COLS)
    .single()

  if (error) {
    if (error.message?.includes('schema cache')) {
      const fallback = await db
        .from('brands')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId)
        .select(BRAND_SAFE_COLS)
        .single()
      if (fallback.error) return err(fallback.error.message)
      if (!fallback.data) return err('Brand not found', 404)
      return NextResponse.json({ success: true, data: fallback.data, timestamp: Date.now() })
    }
    return err(error.message)
  }
  if (!data) return err('Brand not found', 404)
  return NextResponse.json({ success: true, data, timestamp: Date.now() })
}

// ─── DELETE /api/brands/[id] ──────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
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
  const { error } = await db.from('brands').delete().eq('id', id).eq('user_id', userId)

  if (error) return err(error.message)
  return NextResponse.json({ success: true, data: null, timestamp: Date.now() })
}
