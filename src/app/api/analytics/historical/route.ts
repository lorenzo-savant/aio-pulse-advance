// PATH: src/app/api/analytics/historical/route.ts
// Historical Analytics API - Get historical data with trends and comparisons

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { getHistoricalAnalytics, getCompetitorComparison } from '@/lib/services/analytics-service'
import { backfillSnapshotsForRange } from '@/lib/services/citation-snapshots'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { verifyBrandAccess, getWritableBrandIds, requireBrandRole } from '@/lib/authorize'
import { firstZodMessage } from '@/lib/validations'
import { logger } from '@/lib/logger'

const analyticsHistoricalSchema = z.object({
  brand_id: z.string().max(100).optional(),
  generate_all: z.boolean().optional(),
})

/**
 * Date cap for the `generate_all` fan-out. Lower than a single brand's default
 * because this path multiplies the work by the number of writable brands, and
 * it runs inside one request. A truncated rebuild is reported per brand in the
 * response rather than passed off as complete.
 */
const GENERATE_ALL_MAX_DATES = 30

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// ─── GET /api/analytics/historical ───────────────────────────────────────────────
export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`analytics-hist-get:${ip}`, 30, 60_000)
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

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const metric = searchParams.get('metric') || 'citations' // citations, visibility, sentiment, health
  const period = searchParams.get('period') || '30d' // 7d, 30d, 90d, 1y
  const action = searchParams.get('action') || 'history' // history, comparison, generate

  if (!brandId) {
    return err('brand_id is required', 400)
  }

  // Verify user has access to brand
  if (!(await verifyBrandAccess(brandId, userId))) {
    return err('Brand not found or access denied', 404)
  }

  try {
    // Rebuild snapshots on demand.
    if (action === 'generate') {
      // A write hiding behind GET. It rebuilds `citation_snapshots`, so it
      // takes the same editor gate as the POST below — tightening only the
      // POST left the identical operation reachable by a viewer through a
      // query parameter.
      const genGate = await requireBrandRole(brandId, userId, 'editor')
      if ('response' in genGate) return genGate.response

      const result = await backfillSnapshotsForRange(brandId)
      return NextResponse.json({
        success: true,
        data: result,
        timestamp: Date.now(),
      })
    }

    // Get competitor comparison
    if (action === 'comparison') {
      const comparison = await getCompetitorComparison(brandId, {
        period: period as '7d' | '30d' | '90d',
      })
      return NextResponse.json({
        success: true,
        data: comparison,
        timestamp: Date.now(),
      })
    }

    // Get historical analytics (default)
    const analytics = await getHistoricalAnalytics(brandId, {
      metric: metric as 'citations' | 'visibility' | 'sentiment' | 'health',
      period: period as '7d' | '30d' | '90d' | '1y',
    })

    return NextResponse.json({
      success: true,
      data: analytics,
      timestamp: Date.now(),
    })
  } catch (error) {
    logger.error('Historical analytics error', {
      source: 'analytics/historical',
      error: String(error),
    })
    return err('Failed to fetch analytics')
  }
}

// ─── POST /api/analytics/historical — Generate snapshots ─────────────────────────
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
  const rateCheck = await checkRateLimit(`analytics-hist-post:${ip}`, 5, 60_000)
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

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }
  const parsed = analyticsHistoricalSchema.safeParse(rawBody)
  if (!parsed.success) return err(firstZodMessage(parsed.error), 400)
  const { brand_id, generate_all } = parsed.data

  if (generate_all) {
    // Generating a snapshot writes to the brand, so only the brands where the
    // caller is owner or editor — a viewer's "generate all" must not silently
    // skip past its own read-only role. Resolved in two queries rather than
    // two per brand.
    const writableBrandIds = await getWritableBrandIds(db, userId)

    // Rebuilding is per engine × category × language, so a fan-out across
    // every writable brand is the heaviest thing this route can do. Each
    // brand's rebuild is bounded by the backfill's own date cap, and the
    // per-brand result reports whether that cap bit, so a truncated run is
    // visible in the response rather than silently partial.
    const results = []
    for (const brandId of writableBrandIds) {
      const result = await backfillSnapshotsForRange(brandId, { maxDates: GENERATE_ALL_MAX_DATES })
      results.push({ brandId, ...result })
    }

    return NextResponse.json({
      success: true,
      data: { brandsProcessed: results.length, results },
      timestamp: Date.now(),
    })
  }

  if (!brand_id) {
    return err('brand_id is required', 400)
  }

  // Writing a snapshot takes editor rights on the brand.
  const gate = await requireBrandRole(brand_id, userId, 'editor')
  if ('response' in gate) return gate.response

  const result = await backfillSnapshotsForRange(brand_id)

  return NextResponse.json({
    success: true,
    data: result,
    timestamp: Date.now(),
  })
}
