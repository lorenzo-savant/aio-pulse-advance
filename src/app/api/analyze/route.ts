// PATH: src/app/api/analyze/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { analyzeTextSchema } from '@/lib/validations'
import { analyzeWithProvider } from '@/lib/services/analysis'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { verifyBrandAccess } from '@/lib/authorize'
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
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
  const mode = searchParams.get('mode') // 'text' | 'url' | null (all)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // If brand_id provided, verify access
  if (brandId) {
    const brand = await verifyBrandAccess(brandId, userId)
    if (!brand) return err('Brand not found or access denied', 404)
  }

let query = (db as any)
  .from('analysis_results')
  .select('...')
  .order('created_at', { ascending: false })
  .limit(limit)

if (brandId) {
  query = query.eq('brand_id', brandId)
} else {
  query = query.eq('user_id', userId)
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
// Analyzes text or URL content for AIO visibility.
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
    brandId = (body as any).brand_id
  }

  // ── Validate ─────────────────────────────────────────────────────────────
  const parsed = analyzeTextSchema.safeParse(body)
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

  const { input, mode, engine, provider, model } = parsed.data

  // ── Verify brand access if brand_id provided ──────────────────────────────
  const db = createServerClient()
  if (brandId && db) {
    const brand = await verifyBrandAccess(brandId, userId)
    if (!brand) {
      brandId = null // Invalid brand, ignore
    }
  }

  // ── Analyze ───────────────────────────────────────────────────────────────
  try {
    const result = await analyzeWithProvider(input, mode, engine, input, provider, model)

    // ── Save to database ───────────────────────────────────────────────────
    if (userId && !userId.startsWith('anonymous:') && db) {
      try {
        await (db as any).from('analysis_results').insert({
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
          recommendations: result.suggestions,
          raw_response: result,
        })
      } catch (dbError) {
        console.error('[/api/analyze] Failed to save result:', dbError)
      }
    }

    const response: ApiResponse<AnalysisResult> = {
      data: result,
      success: true,
      message: 'Analysis complete',
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
    console.error('[/api/analyze] Error:', error)
    const message = error instanceof Error ? error.message : 'Analysis failed'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}