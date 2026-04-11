// PATH: src/app/api/competitor/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { analyzeCompetitor } from '@/lib/services/gemini'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { verifyBrandAccess } from '@/lib/authorize'

// ─── Validation ─────────────────────────────────────────────────────────────

// Custom validator that accepts both full URLs and domain names
const urlOrDomain = z.string().refine(
  (val) => {
    // If it already has protocol, validate as URL
    if (val.startsWith('http://') || val.startsWith('https://')) {
      try {
        new URL(val)
        return true
      } catch {
        return false
      }
    }
    // Otherwise, check if it looks like a valid domain
    return /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z]{2,})+$/.test(val)
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

    const { data, error: fetchErr } = await (db as any)
      .from('competitor_analyses')
      .select('id, brand_id, primary_url, competitors, summary, created_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (fetchErr) return err(fetchErr.message)

    return NextResponse.json({
      success: true,
      data: data || [],
      timestamp: Date.now(),
    })
  }

  // Otherwise, return user's own analyses
  const { data, error: fetchErr } = await (db as any)
    .from('competitor_analyses')
    .select('id, brand_id, primary_url, competitors, summary, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (fetchErr) return err(fetchErr.message)

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
  let userId: string
  let brandId: string | null = null
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    userId = `anonymous:${ip}`
  }

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

  const parsed = schema.safeParse(body)
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

  const { primaryUrl, competitorUrls } = parsed.data

  // ── Verify brand access if brand_id provided ──────────────────────────────
  const db = createServerClient()
  if (brandId && db) {
    const brand = await verifyBrandAccess(brandId, userId)
    if (!brand) {
      brandId = null
    }
  }

  // Normalize URLs (add https:// if missing)
  const normalizedPrimary = normalizeUrl(primaryUrl)
  const normalizedCompetitors = competitorUrls.map(normalizeUrl)

  try {
    // Analyze all URLs in parallel
    const [primary, ...competitors] = await Promise.all([
      analyzeCompetitor(normalizedPrimary),
      ...normalizedCompetitors.map(analyzeCompetitor),
    ])

    // ── Save to database ───────────────────────────────────────────────────
    if (userId && !userId.startsWith('anonymous:') && db) {
      try {
        await (db as any).from('competitor_analyses').insert({
          brand_id: brandId,
          user_id: userId,
          primary_url: normalizedPrimary,
          competitors: { primary, competitors },
          summary: `Analyzed ${normalizedPrimary} against ${competitorUrls.length} competitors`,
          raw_response: { primary, competitors },
        })
      } catch (dbError) {
        console.error('[/api/competitor] Failed to save result:', dbError)
      }
    }

    return NextResponse.json({
      success: true,
      data: { primary, competitors },
      timestamp: Date.now(),
    })
  } catch (error: unknown) {
    console.error('[/api/competitor] Error:', error)
    const message = error instanceof Error ? error.message : 'Comparison failed'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}