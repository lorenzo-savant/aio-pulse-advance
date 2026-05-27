// PATH: src/app/api/brands/[id]/route.ts
import { formatValidationError } from '@/lib/format-validation-error'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { withDerivedAliases } from '@/lib/brand-aliases'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'

// ─── Validation ───────────────────────────────────────────────────────────────

const updateBrandSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional().nullable(),
  domain: z.string().max(200).optional().nullable(),
  aliases: z.array(z.string().max(100)).max(10).optional(),
  domains: z.array(z.string().max(200)).max(20).optional(),
  competitors: z.array(z.string().max(100)).max(20).optional(),
  industry: z.string().max(100).optional().nullable(),
  market: z.string().max(120).optional().nullable(),
  language: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['en', 'it', 'sv'])).optional(),
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
  // LLMO identity (Schema.org Organization payload + llms-full.txt).
  // Accept camelCase from the form; mapped to snake_case columns below.
  sameAs: z.array(z.string().url()).max(20).optional(),
  disambiguation: z.string().max(2000).optional().nullable(),
  citationFormat: z.string().max(200).optional().nullable(),
  // Legal identifier (VAT / orgnr / fiscal_code / EIN). Maps to Schema.org
  // vatID (legalIdType='vat') or taxID (anything else). The single
  // strongest LLMO entity-resolution signal because it's globally unique.
  legalId: z.string().max(64).optional().nullable(),
  legalIdType: z.enum(['vat', 'orgnr', 'fiscal_code', 'ein', 'other']).optional().nullable(),
})

// Full column list including report_* + LLMO fields (same_as,
// disambiguation, citation_format, legal_id, legal_id_type). Every
// supported deploy has these now — migrations 20260526200000 +
// 20260526300000 are mandatory. The previous BRAND_SAFE_COLS fallback
// silently dropped LLMO data on schema-cache races, masking the real
// problem and letting PATCH calls null out fields the user just typed
// in (Mythos audit, May 2026). Removed in favour of fail-loud.
const BRAND_ALL_COLS =
  'id, user_id, name, slug, description, domain, aliases, domains, competitors, industry, market, language, color, logo_url, is_active, created_at, updated_at, report_logo_url, report_brand_name, report_primary_color, same_as, disambiguation, citation_format, legal_id, legal_id_type'

interface Params {
  params: Promise<{ id: string }>
}

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
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

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`brand-id-get:${ip}`, 30, 60_000)
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
  if (!db) return err('Database not configured', 503)

  const { data, error } = await db
    .from('brands')
    .select(BRAND_ALL_COLS)
    .eq('id', id)
    .eq('user_id', userId)
    .single()

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

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`brand-id-mut:${ip}`, 10, 60_000)
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

  const parsed = updateBrandSchema.safeParse(body)
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

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // Keep the legal-suffix-stripped alias in sync when name + aliases are sent
  // together (the edit form sends both), so exact-match detection keeps working.
  if (typeof parsed.data.name === 'string' && Array.isArray(parsed.data.aliases)) {
    parsed.data.aliases = withDerivedAliases(parsed.data.name, parsed.data.aliases)
  }

  const { data, error } = await db
    .from('brands')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', userId)
    .select(BRAND_ALL_COLS)
    .single()

  // Fail loud on schema-cache errors. The previous fallback selected
  // BRAND_SAFE_COLS which dropped same_as / disambiguation /
  // citation_format / legal_id / legal_id_type from the response, and
  // since the form posts those keys on every save, the user would be
  // shown a "saved successfully" toast while the LLMO data silently
  // never round-tripped. Mythos audit, May 2026.
  if (error) return err(error.message)
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

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`brand-id-mut:${ip}`, 10, 60_000)
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

  const parsed = updateBrandSchema.safeParse(body)
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

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // Filter out undefined values for partial update + map camelCase LLMO
  // fields to their snake_case DB columns. Zod gives us camelCase keys
  // (sameAs, citationFormat, legalId, legalIdType); Supabase expects
  // same_as, citation_format, legal_id, legal_id_type.
  const { sameAs, citationFormat, legalId, legalIdType, ...rest } = parsed.data
  const updateData: Record<string, unknown> = Object.fromEntries(
    Object.entries(rest).filter(([_, v]) => v !== undefined),
  )
  if (sameAs !== undefined) updateData.same_as = sameAs
  if (citationFormat !== undefined) updateData.citation_format = citationFormat
  if (legalId !== undefined) updateData.legal_id = legalId
  if (legalIdType !== undefined) updateData.legal_id_type = legalIdType

  // Keep the legal-suffix-stripped alias in sync when name + aliases change.
  if (typeof updateData.name === 'string' && Array.isArray(updateData.aliases)) {
    updateData.aliases = withDerivedAliases(
      updateData.name as string,
      updateData.aliases as string[],
    )
  }

  const { data, error } = await db
    .from('brands')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', userId)
    .select(BRAND_ALL_COLS)
    .single()

  // Same fail-loud rationale as PUT — see comment there.
  if (error) return err(error.message)
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

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`brand-id-mut:${ip}`, 10, 60_000)
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
  if (!db) return err('Database not configured', 503)
  const { error } = await db.from('brands').delete().eq('id', id).eq('user_id', userId)

  if (error) return err(error.message)
  return NextResponse.json({ success: true, data: null, timestamp: Date.now() })
}
