import { createServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

/**
 * Membership statuses that must NOT grant access to a brand.
 *
 * Two vocabularies exist for `team_members.status` and both are live:
 *   - `TeamStatus` (src/types/index.ts) declares 'pending' | 'accepted' | 'declined'
 *   - the ONLY writer of the table — src/app/api/invitations/accept/route.ts —
 *     inserts 'active'
 *
 * Every access check used to allowlist 'accepted', which no row ever has, so
 * team membership granted nothing: an invited collaborator could accept an
 * invitation and still see none of the brand they were invited to. Denylisting
 * the two states that must never grant access is correct under either
 * vocabulary and stays correct once the data is normalised.
 *
 * PostgREST `not.in` syntax — the value is a parenthesised literal list.
 */
export const INACTIVE_MEMBER_STATUSES = '("pending","declined")'

// Base columns that always exist and are needed for access checks
const BRAND_BASE_COLS =
  'id, name, slug, competitors, aliases, domain, color, description, industry, language'

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
    .not('status', 'in', INACTIVE_MEMBER_STATUSES)
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
    .not('status', 'in', INACTIVE_MEMBER_STATUSES)
    .in('role', ['owner', 'editor'])
    .single()

  return !!membership
}

/**
 * A brand is a shared workspace, not a private folder.
 *
 * Everything hanging off a brand — prompts, monitoring results, alerts, scans,
 * reports — belongs to the BRAND, and every collaborator on that brand can read
 * it. Rows still carry the `user_id` of whoever created them (useful as
 * provenance, and the column is not going anywhere), but that column must never
 * be used to decide who may SEE a row. Filtering brand data by
 * `user_id = <viewer>` is what made an invited colleague open a brand and find
 * it empty: they got the brand, then none of its contents.
 *
 * Read access  → any role (owner | editor | viewer)
 * Write access → owner | editor. A viewer may not create, modify, or spend.
 *
 * `personal` resources are the deliberate exception and keep their per-user
 * filter: credit balances, API keys, and anything else that belongs to a person
 * rather than to a brand.
 */
export type BrandRole = 'owner' | 'editor' | 'viewer'

const ROLE_RANK: Record<BrandRole, number> = { viewer: 0, editor: 1, owner: 2 }

/**
 * Resolve the caller's role on a brand — the single question every brand-scoped
 * endpoint should ask. Returns null when the caller has no access at all.
 *
 * The brand's `user_id` outranks any membership row: the owner is an owner even
 * if a stale `team_members` row calls them a viewer.
 */
export async function getBrandRole(brandId: string, userId: string): Promise<BrandRole | null> {
  const db = createServerClient()
  if (!db) return null

  const { data: brand } = await db.from('brands').select('user_id').eq('id', brandId).maybeSingle()

  if (brand && String(brand.user_id) === userId) return 'owner'

  const { data: membership } = await db
    .from('team_members')
    .select('role')
    .eq('brand_id', brandId)
    .eq('user_id', userId)
    .not('status', 'in', INACTIVE_MEMBER_STATUSES)
    .maybeSingle()

  if (!membership) return null

  // The column is free text with a CHECK; anything unrecognised is treated as
  // the least privilege that still grants access rather than silently as edit.
  const role = String(membership.role) as BrandRole
  return role in ROLE_RANK ? role : 'viewer'
}

/**
 * Gate for endpoints that mutate brand data or spend the brand's credits.
 * Returns the caller's role on success, or the NextResponse to return.
 *
 * Usage:
 *   const gate = await requireBrandRole(brandId, userId, 'editor')
 *   if ('response' in gate) return gate.response
 */
export async function requireBrandRole(
  brandId: string,
  userId: string,
  minimum: BrandRole = 'viewer',
): Promise<{ role: BrandRole } | { response: NextResponse }> {
  const role = await getBrandRole(brandId, userId)

  // Absence of access and insufficient access are answered differently on
  // purpose: a stranger must not learn that the brand exists, while a viewer
  // already knows and needs to be told why the action was refused.
  if (!role) return { response: errResponse('Brand not found or access denied', 404) }

  if (ROLE_RANK[role] < ROLE_RANK[minimum]) {
    return {
      response: errResponse(
        `This action requires ${minimum} access to the brand; your role is ${role}.`,
        403,
      ),
    }
  }

  return { role }
}

/**
 * Whose credits pay for work on this brand: the owner's.
 *
 * A brand is one shared project with one budget. If billing followed the caller
 * instead, a colleague with an empty balance could not run the analyses they
 * were invited to run, and the brand's spend would be scattered across every
 * account that touched it.
 */
export async function getBrandBillingUserId(brandId: string): Promise<string | null> {
  const db = createServerClient()
  if (!db) return null

  const { data } = await db.from('brands').select('user_id').eq('id', brandId).maybeSingle()

  return data?.user_id ? String(data.user_id) : null
}

/**
 * Get all brand IDs the user has access to (owned + team member).
 */
export async function getAccessibleBrandIds(
  db: ReturnType<typeof createServerClient>,
  userId: string,
  workspaceId?: string,
): Promise<string[]> {
  if (!db) return []

  // This is the read scope for every brand-scoped list endpoint: the set of
  // brands the caller may see anything inside. Callers filter with
  // `.in('brand_id', ids)` — never with `.eq('user_id', callerId)`, which
  // returns only the caller's own rows and hides a colleague's work.
  //
  // An empty array is a real answer (the caller has no brands) and correctly
  // yields no rows through `.in()` — measured against the live PostgREST
  // (postgrest-js 2.97.0): `.in('col', [])` returns no error and 0 rows, also
  // with count:'exact', order and limit. There is nothing to special-case.
  //
  // Independent queries — run together.
  const ownedQuery = workspaceId
    ? db.from('brands').select('id').eq('user_id', userId).eq('workspace_id', workspaceId)
    : db.from('brands').select('id').eq('user_id', userId)

  const [{ data: ownedBrands }, { data: teamMemberships }] = await Promise.all([
    ownedQuery,
    db
      .from('team_members')
      .select('brand_id')
      .eq('user_id', userId)
      .not('status', 'in', INACTIVE_MEMBER_STATUSES),
  ])

  const ownedIds = (ownedBrands || []).map((b) => b.id)
  let teamIds = (teamMemberships || []).map((m) => m.brand_id)

  // A workspace filter has to apply to BOTH halves of the union. The inline
  // copy this replaced filtered only the owned half, so asking for one
  // workspace still returned every brand you collaborate on anywhere — the
  // scope silently leaked exactly where it was meant to narrow.
  if (workspaceId && teamIds.length > 0) {
    const { data: inWorkspace } = await db
      .from('brands')
      .select('id')
      .in('id', teamIds)
      .eq('workspace_id', workspaceId)
    teamIds = (inWorkspace || []).map((b) => b.id)
  }

  // De-dup: an owner who is also listed as a team member must not produce
  // duplicate IDs for downstream .in() filters.
  return [...new Set([...ownedIds, ...teamIds])]
}

/**
 * The brands the caller may WRITE to — owned, plus memberships that carry an
 * editor or owner role.
 *
 * The obvious way to build this is to take getAccessibleBrandIds and ask
 * getBrandRole about each id, which costs two queries per brand and grows with
 * the account. Two queries answer it for any number of brands.
 */
export async function getWritableBrandIds(
  db: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<string[]> {
  if (!db) return []

  const [{ data: ownedBrands }, { data: teamMemberships }] = await Promise.all([
    db.from('brands').select('id').eq('user_id', userId),
    db
      .from('team_members')
      .select('brand_id')
      .eq('user_id', userId)
      .not('status', 'in', INACTIVE_MEMBER_STATUSES)
      .in('role', ['owner', 'editor']),
  ])

  return [
    ...new Set([
      ...(ownedBrands || []).map((b) => b.id),
      ...(teamMemberships || []).map((m) => m.brand_id),
    ]),
  ]
}
