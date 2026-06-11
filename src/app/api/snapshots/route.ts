// PATH: src/app/api/snapshots/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { calculateCitationSnapshots } from '@/lib/services/citation-snapshots'
import { verifyBrandAccess } from '@/lib/authorize'
import { firstZodMessage } from '@/lib/validations'
import { logger } from '@/lib/logger'

const snapshotsCreateSchema = z.object({
  brand_id: z.string().min(1, 'brand_id is required'),
  date: z.string().max(40).optional(),
})

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// ─── POST /api/snapshots — Calculate snapshots for a brand ───────────────────
export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }
  const parsed = snapshotsCreateSchema.safeParse(rawBody)
  if (!parsed.success) return err(firstZodMessage(parsed.error), 400)
  const body = parsed.data

  // Verify brand access using the safe verifyBrandAccess (no report_* columns)
  const brand = await verifyBrandAccess(body.brand_id, userId)
  if (!brand) {
    return err('Brand not found or access denied', 404)
  }

  const result = await calculateCitationSnapshots(body.brand_id, body.date)

  return NextResponse.json({
    success: true,
    data: result,
    message: `${result.inserted} snapshots calculated`,
    timestamp: Date.now(),
  })
}

// ─── GET /api/snapshots — Retrieve snapshots for trend charts ────────────────
// Query params: brand_id (required), from, to, engine, category
export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const engine = searchParams.get('engine') || 'all'
  const category = searchParams.get('category') || 'all'
  const language = searchParams.get('language') || 'all'
  const from = searchParams.get('from') // 'YYYY-MM-DD'
  const to = searchParams.get('to') || new Date().toISOString().split('T')[0]

  if (!brandId) {
    return err('brand_id is required', 400)
  }

  // Verify user has access to this brand (ownership or team membership)
  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) {
    return err('Brand not found or access denied', 404)
  }

  // Default "from" = 30 days ago
  const defaultFrom = new Date()
  defaultFrom.setDate(defaultFrom.getDate() - 30)
  const fromDate = from || defaultFrom.toISOString().split('T')[0]

  let query = db
    .from('citation_snapshots')
    .select('*')
    .eq('brand_id', brandId)
    .gte('scan_date', fromDate)
    .lte('scan_date', to)
    .order('scan_date', { ascending: true })

  if (engine !== 'all') {
    query = query.eq('engine', engine)
  } else {
    query = query.eq('engine', 'all') // Get the "all engines" aggregation
  }

  if (category !== 'all') {
    query = query.eq('category', category)
  } else {
    query = query.eq('category', 'all') // Get the "all categories" aggregation
  }

  if (language !== 'all') {
    query = query.eq('language', language)
  } else {
    query = query.eq('language', 'all') // Get the "all languages" aggregation
  }

  const { data, error: fetchError } = await query

  if (fetchError) {
    logger.error('/api/snapshots failed', { err: fetchError })
    return err('Failed to load data')
  }

  // Also return latest snapshot summary
  const latest = data && data.length > 0 ? data[data.length - 1] : null

  return NextResponse.json({
    success: true,
    data: {
      snapshots: data || [],
      latest,
      filters: { engine, category, from: fromDate, to },
    },
    timestamp: Date.now(),
  })
}
