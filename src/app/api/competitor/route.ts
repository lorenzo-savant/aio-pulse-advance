// PATH: src/app/api/competitor/route.ts
import { formatValidationError } from '@/lib/format-validation-error'
import { type NextRequest, NextResponse } from 'next/server'
import type { Json } from '@/types/database'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { analyzeCompetitor } from '@/lib/services/gemini'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess, getAccessibleBrandIds, requireBrandRole } from '@/lib/authorize'

// ─── Validation ─────────────────────────────────────────────────────────────

// Custom validator that accepts URLs with or without protocol,
// www-prefixed domains, and bare domains like example.com
const urlOrDomain = z.string().refine(
  (val) => {
    const trimmed = val.trim()
    if (!trimmed) return false
    try {
      const url = new URL(
        trimmed.startsWith('http://') || trimmed.startsWith('https://')
          ? trimmed
          : `https://${trimmed}`,
      )
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  },
  { message: 'Must be a valid URL (https://example.com) or domain (example.com)' },
)

// Pre-process URLs to add https:// if missing
function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`
  }
  return url
}

const schema = z.object({
  primaryUrl: urlOrDomain,
  competitorUrls: z
    .array(urlOrDomain)
    .min(1, 'At least one competitor URL is required')
    .max(3, 'Maximum 3 competitor URLs allowed'),
})

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// ─── GET /api/competitor?brand_id=xxx ───────────────────────────────────────
// Load saved competitor analysis history
export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10) || 10, 50)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // If brand_id provided, verify access and filter by brand
  if (brandId) {
    const brand = await verifyBrandAccess(brandId, userId)
    if (!brand) return err('Brand not found or access denied', 404)

    const { data, error: fetchErr } = await db
      .from('competitor_analyses')
      .select('id, brand_id, primary_url, competitors, summary, created_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (fetchErr) {
      logger.error('/api/competitor failed', { err: fetchErr })
      return err('Failed to load data')
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      timestamp: Date.now(),
    })
  }

  // Otherwise, every analysis across the brands the caller can read — not just
  // the ones they personally ran.
  const accessibleBrandIds = await getAccessibleBrandIds(db, userId)

  const { data, error: fetchErr } = await db
    .from('competitor_analyses')
    .select('id, brand_id, primary_url, competitors, summary, created_at')
    .in('brand_id', accessibleBrandIds)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (fetchErr) {
    logger.error('/api/competitor failed', { err: fetchErr })
    return err('Failed to load data')
  }

  return NextResponse.json({
    success: true,
    data: data || [],
    timestamp: Date.now(),
  })
}

// ─── POST /api/competitor ─────────────────────────────────────────────────────
// Fetches and analyzes the primary URL and up to 3 competitor URLs via Gemini.
// Rate limited: 10 requests per minute per IP (each call makes 4+ Gemini calls).
export async function POST(req: NextRequest) {
  // Rate limit — competitor analysis is expensive (fetches + Gemini calls per URL)
  const ip = getClientIp(req.headers)
  const rl = await checkRateLimit(`competitor:${ip}`, 10, 60_000)

  if (!rl.success) {
    return NextResponse.json(
      {
        success: false,
        message: `Rate limit exceeded. Try again in ${Math.ceil((rl.resetAt - Date.now()) / 1000)}s.`,
      },
      { status: 429 },
    )
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  // Auth required (pentest 2026-08-19). This POST fetches attacker-supplied
  // URLs (SSRF vector) and makes ~4 Gemini calls per request on the org's own
  // keys (denial-of-wallet). Both were reachable anonymously via the
  // anonymous:${ip} fallback with only a per-IP rate limit. The GET on this
  // route stays public — it only reads stored analyses.
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  let brandId: string | null = null

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  // ── Extract brand_id if present ─────────────────────────────────────────
  if (body && typeof body === 'object' && 'brand_id' in body) {
    brandId = (body as Record<string, unknown>).brand_id as string
  }

  const parsed = schema.safeParse(body)
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

  const { primaryUrl, competitorUrls } = parsed.data

  // ── Gate on the brand if brand_id provided ────────────────────────────────
  // This runs paid Gemini analysis and inserts a row, so it takes editor
  // rights. Refusing outright replaces the worst shape in this file: a denied
  // brand_id used to be silently blanked to null, and the request carried on —
  // the analysis still ran (and cost), a row was still written with no brand,
  // and the caller got 200. Denial that spends money and saves orphan data is
  // not denial.
  const db = createServerClient()
  if (brandId) {
    if (userId.startsWith('anonymous:')) {
      return NextResponse.json(
        { success: false, message: 'Sign in to analyse competitors for a brand' },
        { status: 401 },
      )
    }
    const gate = await requireBrandRole(brandId, userId, 'editor')
    if ('response' in gate) return gate.response
  }

  // Normalize URLs (add https:// if missing)
  const normalizedPrimary = normalizeUrl(primaryUrl)
  const normalizedCompetitors = competitorUrls.map(normalizeUrl)

  // Analyze every URL independently so one unreachable/blocking competitor
  // site doesn't sink the whole comparison (the old Promise.all behavior).
  const [primarySettled, ...competitorsSettled] = await Promise.allSettled([
    analyzeCompetitor(normalizedPrimary),
    ...normalizedCompetitors.map(analyzeCompetitor),
  ])

  // The primary site is mandatory — if it failed, surface the real reason
  // (e.g. "GEMINI_API_KEY not configured", "Access denied (403)…") instead
  // of a generic message so the user can act on it.
  if (primarySettled.status === 'rejected') {
    const reason =
      primarySettled.reason instanceof Error
        ? primarySettled.reason.message
        : String(primarySettled.reason)
    logger.error('Competitor analysis: primary failed', { source: 'competitor', reason })
    return err(`Could not analyze ${normalizedPrimary}: ${reason}`, 502)
  }
  const primary = primarySettled.value

  const competitors = competitorsSettled
    .filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof analyzeCompetitor>>> =>
        r.status === 'fulfilled',
    )
    .map((r) => r.value)

  const failedCompetitors = competitorsSettled
    .map((r, i) =>
      r.status === 'rejected'
        ? {
            url: normalizedCompetitors[i],
            reason: r.reason instanceof Error ? r.reason.message : String(r.reason),
          }
        : null,
    )
    .filter((x): x is { url: string | undefined; reason: string } => x !== null)

  if (failedCompetitors.length > 0) {
    logger.warn('Competitor analysis: some competitors failed', {
      source: 'competitor',
      failed: failedCompetitors,
    })
  }

  // Every competitor failed — tell the user why rather than returning an
  // empty, confusing result set.
  if (competitors.length === 0) {
    const reason = failedCompetitors[0]?.reason ?? 'unknown error'
    return err(`Could not analyze any competitor URL: ${reason}`, 502)
  }

  // ── Save to database ───────────────────────────────────────────────────
  if (userId && !userId.startsWith('anonymous:') && db) {
    try {
      await db.from('competitor_analyses').insert({
        brand_id: brandId,
        user_id: userId,
        primary_url: normalizedPrimary,
        competitors: { primary, competitors } as unknown as Json,
        summary: `Analyzed ${normalizedPrimary} against ${competitors.length} competitors`,
        raw_response: { primary, competitors } as unknown as Json,
      })
    } catch (dbError) {
      logger.error('Failed to save result', { source: 'competitor', error: String(dbError) })
    }
  }

  return NextResponse.json({
    success: true,
    data: { primary, competitors },
    // Surface partial failures so the UI can warn without hard-failing.
    warnings: failedCompetitors.length > 0 ? failedCompetitors : undefined,
    timestamp: Date.now(),
  })
}
