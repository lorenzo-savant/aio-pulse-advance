// PATH: src/app/api/gsc/striking-distance/route.ts
//
// GET /api/gsc/striking-distance?brand_id=…&min_impressions=100
//
// Surfaces "striking distance" queries from Google Search Console: terms the
// brand already ranks for between positions 11–30 with meaningful impression
// volume — i.e. queries Google already considers relevant where a small
// content/meta push has the biggest expected ROI. Reads gsc_performance rows
// already synced by the GSC integration; no new external API.

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import {
  estimateUpliftClicks,
  strikingDistanceBand,
  STRIKING_DISTANCE_TARGET_POSITION,
} from '@/lib/utils/striking-distance'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface GscQueryRow {
  date: string
  dimension_value: string | null
  clicks: number | null
  impressions: number | null
  ctr: number | null
  position: number | null
}

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const minImpressions = Math.max(1, Number(searchParams.get('min_impressions')) || 100)
  const minPosition = Math.max(1, Number(searchParams.get('min_position')) || 11)
  const maxPosition = Math.min(100, Number(searchParams.get('max_position')) || 30)

  if (!brandId) return err('brand_id is required', 400)
  if (!(await verifyBrandAccess(brandId, userId))) return err('Forbidden', 403)

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const { data, error } = await (db as any)
      .from('gsc_performance')
      .select('date, dimension_value, clicks, impressions, ctr, position')
      .eq('brand_id', brandId)
      .eq('dimension_type', 'query')
      .order('date', { ascending: false })
      .limit(2000)
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (error) {
      logger.error('/api/gsc/striking-distance query failed', { err: error })
      return err('Failed to load GSC query data')
    }

    const rows = (data || []) as GscQueryRow[]

    // Dedupe per query keeping the MOST RECENT row (rows came back
    // date-desc above, so the first hit per query wins).
    const latestByQuery = new Map<string, GscQueryRow>()
    for (const r of rows) {
      const q = (r.dimension_value || '').trim()
      if (!q) continue
      if (!latestByQuery.has(q)) latestByQuery.set(q, r)
    }

    const enriched = [...latestByQuery.values()]
      .filter((r) => {
        const pos = r.position ?? 0
        const imp = r.impressions ?? 0
        return pos >= minPosition && pos <= maxPosition && imp >= minImpressions
      })
      .map((r) => {
        const impressions = r.impressions ?? 0
        const ctr = r.ctr ?? 0
        const position = r.position ?? 0
        const upliftClicks = estimateUpliftClicks(impressions, ctr)
        return {
          query: r.dimension_value!,
          impressions,
          clicks: r.clicks ?? 0,
          ctr: Math.round(ctr * 10000) / 100, // percentage rounded to 0.01
          position: Math.round(position * 10) / 10,
          band: strikingDistanceBand(position),
          upliftClicks,
          lastSeen: r.date,
        }
      })
      // Sort by uplift potential desc (highest expected payoff first).
      .sort((a, b) => b.upliftClicks - a.upliftClicks || b.impressions - a.impressions)

    const totalUplift = enriched.reduce((s, q) => s + q.upliftClicks, 0)

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalQueries: enriched.length,
          totalImpressions: enriched.reduce((s, q) => s + q.impressions, 0),
          totalEstimatedUplift: totalUplift,
          targetPosition: STRIKING_DISTANCE_TARGET_POSITION,
          minImpressions,
          positionRange: { min: minPosition, max: maxPosition },
        },
        queries: enriched.slice(0, 100),
      },
      timestamp: Date.now(),
    })
  } catch (e) {
    logger.error('/api/gsc/striking-distance failed', { err: e })
    return err('Failed to compute striking-distance queries')
  }
}
