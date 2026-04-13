import { createServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

// Base columns that always exist and are needed for access checks
const BRAND_BASE_COLS = 'id, name, slug, competitors, aliases, domain, color'

// Extended columns for reports/export (may not exist in older schemas)
const BRAND_REPORT_COLS =
  'id, name, slug, competitors, aliases, domain, color, description, industry, logo_url, is_active, created_at, updated_at, language, report_logo_url, report_brand_name, report_primary_color'

export interface BrandAccess {
  id: string
  name: string
  slug: string
  competitors: string[]
  aliases: string[]
  domain: string | null
  color: string
  description: string | null
  industry: string | null
  logo_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  language: string
  report_logo_url?: string | null
  report_brand_name?: string | null
  report_primary_color?: string | null
  user_id?: string
}

export interface PromptAccess {
  id: string
  brand_id: string
  text: string
  language: string
  market: string
  category: string | null
  brand?: BrandAccess
}

export interface AlertAccess {
  id: string
  brand_id: string
  name: string
  type: string
  brand?: BrandAccess
}

function errResponse(message: string, status = 403): NextResponse {
  return NextResponse.json({ success: false, message }, { status })
}

/**
 * Verify that a brand belongs to the given user OR user is a team member.
 * Returns the brand if accessible, null if not.
 * @param includeReportCols - if true, also select report_* columns (for export/report pages)
 */
export async function verifyBrandAccess(
  brandId: string,
  userId: string,
  includeReportCols = false,
): Promise<BrandAccess | null> {
  const db = createServerClient()
  if (!db) return null

  const cols = includeReportCols ? BRAND_REPORT_COLS : BRAND_BASE_COLS

  // Check if user owns the brand
  const { data: ownedBrand, error: ownedErr } = await db
    .from('brands')
    .select(cols)
    .eq('id', brandId)
    .eq('user_id', userId)
    .single()

  if (ownedBrand && !ownedErr) {
    return ownedBrand as unknown as BrandAccess
  }

  // Check if user is a team member with access
  const { data: membership } = await db
    .from('team_members')
    .select('brand_id')
    .eq('brand_id', brandId)
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .single()

  if (membership) {
    // User has team access - fetch brand details
    const { data: teamBrand } = await db.from('brands').select(cols).eq('id', brandId).single()

    return teamBrand as BrandAccess | null
  }

  return null
}

/**
 * Verify brand ownership ONLY (not team members).
 * Use when editing/deleting brand settings.
 */
export async function verifyBrandOwnership(
  brandId: string,
  userId: string,
  includeReportCols = false,
): Promise<BrandAccess | null> {
  const db = createServerClient()
  if (!db) return null

  const cols = includeReportCols ? BRAND_REPORT_COLS : BRAND_BASE_COLS

  const { data } = await db
    .from('brands')
    .select(cols)
    .eq('id', brandId)
    .eq('user_id', userId)
    .single()

  return data as BrandAccess | null
}

/**
 * Verify that a prompt belongs to the given user (via brand ownership or team membership).
 */
export async function verifyPromptOwnership(
  promptId: string,
  userId: string,
): Promise<PromptAccess | null> {
  const db = createServerClient()
  if (!db) return null

  const { data } = await db
    .from('prompts')
    .select(
      'id, brand_id, text, language, market, category, brand:brands(id, name, slug, competitors, aliases, domain, color)',
    )
    .eq('id', promptId)
    .single()

  if (!data) return null

  const brandAccess = await verifyBrandAccess(data.brand_id, userId)
  if (!brandAccess) return null

  return {
    ...data,
    brand: brandAccess,
  } as PromptAccess
}

/**
 * Verify that an alert rule belongs to the given user (via brand ownership or team membership).
 */
export async function verifyAlertOwnership(
  alertRuleId: string,
  userId: string,
): Promise<AlertAccess | null> {
  const db = createServerClient()
  if (!db) return null

  const { data } = await db
    .from('alert_rules')
    .select(
      'id, brand_id, name, type, brand:brands(id, name, slug, competitors, aliases, domain, color)',
    )
    .eq('id', alertRuleId)
    .single()

  if (!data || !data.brand_id) return null

  const brandAccess = await verifyBrandAccess(data.brand_id, userId)
  if (!brandAccess) return null

  return {
    ...data,
    brand: brandAccess,
  } as AlertAccess
}

/**
 * Check if user can edit a brand (owner or editor role).
 */
export async function canEditBrand(brandId: string, userId: string): Promise<boolean> {
  const db = createServerClient()
  if (!db) return false

  const { data: brand } = await db.from('brands').select('user_id').eq('id', brandId).single()

  if (String(brand?.user_id) === userId) return true

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

/**
 * Get all brand IDs the user has access to (owned + team member).
 */
export async function getAccessibleBrandIds(
  db: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<string[]> {
  if (!db) return []

  const { data: ownedBrands } = await db.from('brands').select('id').eq('user_id', userId)

  const ownedIds = (ownedBrands || []).map((b) => b.id)

  const { data: teamMemberships } = await db
    .from('team_members')
    .select('brand_id')
    .eq('user_id', userId)
    .eq('status', 'accepted')

  const teamIds = (teamMemberships || []).map((m) => m.brand_id)

  return [...ownedIds, ...teamIds]
}
