// PATH: src/app/api/analyze/route.ts
import { formatValidationError } from '@/lib/format-validation-error'
import { type NextRequest, NextResponse } from 'next/server'
import type { Json } from '@/types/database'
import { analyzeTextSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { analyzeWithProvider } from '@/lib/services/analysis'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { verifyBrandAccess, getAccessibleBrandIds, requireBrandRole } from '@/lib/authorize'
import type { ApiResponse, AnalysisResult } from '@/types'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// ─── GET /api/analyze?brand_id=xxx&limit=10 ─────────────────────────────────
// Load saved analysis history (Content Optimizer + Audit results)
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
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 100)
  const mode = searchParams.get('mode') // 'text' | 'url' | null (all)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // If brand_id provided, verify access
  if (brandId) {
    const brand = await verifyBrandAccess(brandId, userId)
    if (!brand) return err('Brand not found or access denied', 404)
  }

  let query = db
    .from('analysis_results')
    .select('...')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (brandId) {
    query = query.eq('brand_id', brandId)
  } else {
    // Unfiltered means "everything I can see", which is every brand the caller
    // collaborates on — not only the analyses they personally ran.
    const scope = await getAccessibleBrandIds(db, userId)
    // Empty scope is a real answer (the caller has no brands), not an error to
    // push through PostgREST's `.in()` serialization. Same guard as /api/monitoring.
    if (scope.length === 0) {
      return NextResponse.json({ success: true, data: [], timestamp: Date.now() })
    }
    query = query.in('brand_id', scope)
  }

  const { data, error: fetchErr } = await query

  if (fetchErr) return err(fetchErr.message)

  return NextResponse.json({
    success: true,
    data: data || [],
    timestamp: Date.now(),
  })
}

// ─── POST /api/analyze ────────────────────────────────────────────────────────
// Analyzes text or URL content for AEO visibility.
// Rate limited: 20 requests per minute per IP.
export async function POST(req: NextRequest) {
  // ── Rate limit ────────────────────────────────────────────────────────────
  const ip = getClientIp(req.headers)
  const rl = await checkRateLimit(ip, 20, 60_000)

  if (!rl.success) {
    return NextResponse.json(
      {
        success: false,
        message: `Rate limit exceeded. Try again in ${Math.ceil((rl.resetAt - Date.now()) / 1000)}s.`,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '20',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rl.resetAt),
          'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      },
    )
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  let userId: string
  let brandId: string | null = null
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    // Allow unauthenticated requests but without saving to history
    userId = `anonymous:${ip}`
  }

  // ── Parse body ───────────────────────────────────────────────────────────
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

  // ── Validate ─────────────────────────────────────────────────────────────
  const parsed = analyzeTextSchema.safeParse(body)
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

  const { input, mode, engine, provider, model } = parsed.data
  const isAnonymous = userId.startsWith('anonymous:')

  // ── Anonymous request hardening (pentest 2026-08-19) ──────────────────────
  // The anonymous fallback is a deliberate lead magnet, but it spends the
  // org's own LLM budget on the org's own keys, and mode:'url' turns it into
  // an SSRF vector (the fetched page is reflected back to the caller). Two
  // gates keep the lead magnet without the two exploits:
  //   1. URL fetching requires auth. Anonymous callers may analyse pasted
  //      TEXT only — no outbound fetch, so no unauthenticated SSRF, and the
  //      DNS-rebinding residual in safeFetch is reachable only by an
  //      authenticated editor from here on.
  //   2. Anonymous callers cannot pick the model. Left free, an attacker
  //      steered every free call to the priciest model (gpt-4o / claude).
  //      Anonymous text analysis is pinned to the default (cheapest) tier.
  if (isAnonymous && mode === 'url') {
    return NextResponse.json(
      { success: false, message: 'Sign in to analyse a URL' },
      { status: 401 },
    )
  }
  const effectiveModel = isAnonymous ? 'default' : model
  const effectiveProvider = isAnonymous ? 'gemini' : provider

  // ── Gate on the brand if brand_id provided ────────────────────────────────
  // This runs a paid LLM analysis and inserts a row, so it takes editor rights.
  // A denied brand_id used to be silently blanked to null and the request
  // carried on — the analysis still ran (and cost), a row was still written
  // with no brand, and the caller got 200. Denial that spends money and saves
  // orphan data is not denial.
  const db = createServerClient()
  let brandContext:
    | {
        name: string
        industry?: string | null
        description?: string | null
        competitors?: string[] | null
      }
    | undefined
  if (brandId && db) {
    if (userId.startsWith('anonymous:')) {
      return NextResponse.json(
        { success: false, message: 'Sign in to analyse for a brand' },
        { status: 401 },
      )
    }
    const gate = await requireBrandRole(brandId, userId, 'editor')
    if ('response' in gate) return gate.response

    const brand = await verifyBrandAccess(brandId, userId)
    if (!brand) return err('Brand not found or access denied', 404)

    brandContext = {
      name: brand.name,
      industry: brand.industry,
      description: brand.description,
      competitors: brand.competitors,
    }
  }

  // ── Analyze ───────────────────────────────────────────────────────────────
  try {
    const result = await analyzeWithProvider(
      input,
      mode,
      engine,
      input,
      effectiveProvider,
      effectiveModel,
      brandContext,
    )

    // ── Save to database ───────────────────────────────────────────────────
    // Track persistence so the client can warn when history won't survive.
    // Anonymous users skip persistence by design (no user_id to scope to);
    // we report null for them to distinguish "by-design skip" from "failed save".
    let persisted: boolean | null = null
    if (userId && !userId.startsWith('anonymous:') && db) {
      persisted = true
      try {
        const { error: insertErr } = await db.from('analysis_results').insert({
          brand_id: brandId,
          user_id: userId,
          input,
          input_mode: mode,
          engine,
          provider,
          model,
          visibility_score: result.visibilityScore,
          sentiment: result.engineBreakdown?.[0]?.status,
          summary: result.summary,
          recommendations: result.suggestions as unknown as Json,
          raw_response: result as unknown as Json,
        })
        if (insertErr) {
          logger.error('Failed to save result', { source: 'analyze', error: insertErr.message })
          persisted = false
        }
      } catch (dbError) {
        logger.error('Failed to save result', { source: 'analyze', error: String(dbError) })
        persisted = false
      }
    }

    const response: ApiResponse<AnalysisResult> & { persisted: boolean | null } = {
      data: result,
      success: true,
      message: 'Analysis complete',
      // persisted: true → saved to history; false → DB save failed (client
      // can show "result shown but history unavailable"); null → anonymous
      // / DB not configured, persistence was intentionally skipped.
      persisted,
      timestamp: Date.now(),
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'X-RateLimit-Limit': '20',
        'X-RateLimit-Remaining': String(rl.remaining),
        'X-RateLimit-Reset': String(rl.resetAt),
      },
    })
  } catch (error: unknown) {
    logger.error('Analysis error', { source: 'analyze', error: String(error) })
    return NextResponse.json({ success: false, message: 'Analysis failed' }, { status: 500 })
  }
}
