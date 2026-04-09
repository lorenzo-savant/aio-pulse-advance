// PATH: src/app/api/analytics/historical/route.ts
// Historical Analytics API - Get historical data with trends and comparisons

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import {
  getHistoricalAnalytics,
  getCompetitorComparison,
  autoGenerateSnapshots,
} from '@/lib/services/analytics-service'

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
  const { data: brand } = await (db as any)
    .from('brands')
    .select('id, user_id')
    .eq('id', brandId)
    .single()

  if (!brand || brand.user_id !== userId) {
    return err('Brand not found or access denied', 404)
  }

  try {
    // Auto-generate snapshots if needed
    if (action === 'generate') {
      const result = await autoGenerateSnapshots(brandId)
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
    console.error('[analytics/historical] Error:', error)
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

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  let body: { brand_id?: string; generate_all?: boolean }
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const { brand_id, generate_all } = body

  if (generate_all) {
    // Generate snapshots for all user's brands
    const { data: brands } = await (db as any).from('brands').select('id').eq('user_id', userId)

    const results = []
    for (const brand of brands || []) {
      const result = await autoGenerateSnapshots(brand.id)
      results.push({ brandId: brand.id, ...result })
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

  // Verify access
  const { data: brand } = await (db as any)
    .from('brands')
    .select('id')
    .eq('id', brand_id)
    .eq('user_id', userId)
    .single()

  if (!brand) {
    return err('Brand not found or access denied', 404)
  }

  const result = await autoGenerateSnapshots(brand_id)

  return NextResponse.json({
    success: true,
    data: result,
    timestamp: Date.now(),
  })
}
