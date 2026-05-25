// PATH: src/app/api/gsc/branded-search/route.ts
//
// GET /api/gsc/branded-search?brand_id=…&days=90
//
// "AI is making people search for you" report.
//
// Reads gsc_performance query-dimension rows for the brand, splits them
// into branded vs non-branded using brand name + aliases + domain stem,
// and returns:
//   - summary (clicks/impressions/uniqueQueries per bucket, branded share)
//   - daily timeline (so the UI can plot brand-volume growth)
//   - growth delta (second-half vs first-half of the window)
//   - top branded queries (highest impressions in the window)
//
// Pure aggregation over already-synced GSC data — no new external API.

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import {
  brandAnchors,
  classifyBrandedQueries,
  brandedGrowthRate,
  aiAssistScore,
  isBrandedQuery,
  type QueryRow,
} from '@/lib/utils/branded-search'
import type { Brand } from '@/types'
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
  const days = Math.min(365, Math.max(7, Number(searchParams.get('days')) || 90))

  if (!brandId) return err('brand_id is required', 400)

  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  const since = new Date()
  since.setDate(since.getDate() - days)

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const { data, error } = await (db as any)
      .from('gsc_performance')
      .select('date, dimension_value, clicks, impressions, ctr, position')
      .eq('brand_id', brandId)
      .eq('dimension_type', 'query')
      .gte('date', since.toISOString().slice(0, 10))
      .order('date', { ascending: true })
      .limit(10_000)
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // GSC sync is optional — when the brand hasn't connected Search Console
    // (or the table isn't migrated on this deployment), the query fails.
    // Degrade gracefully: empty buckets + gscAvailable=false flag so the
    // panel can show a "connect GSC" hint instead of a raw error.
    let gscAvailable = true
    if (error) {
      logger.warn('/api/gsc/branded-search gsc query unavailable — degrading', {
        err: String(error),
      })
      gscAvailable = false
    }

    const rawRows = (gscAvailable ? data || [] : []) as GscQueryRow[]
    const b = brand as Brand
    const anchors = brandAnchors({
      name: b.name,
      aliases: b.aliases ?? [],
      domain: b.domain ?? b.domains?.[0] ?? null,
    })

    const rows: QueryRow[] = rawRows
      .filter((r) => typeof r.dimension_value === 'string' && r.dimension_value.trim().length > 0)
      .map((r) => ({
        query: r.dimension_value as string,
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        position: r.position ?? undefined,
        date: r.date,
      }))

    const { summary, timeline } = classifyBrandedQueries(rows, anchors)
    const growth = brandedGrowthRate(timeline)
    const aiAssist = aiAssistScore(timeline)

    // Top branded queries by impressions in-window — useful so the UI can
    // show WHICH branded queries grew (e.g. "<brand> reviews" trending up
    // is the canonical AEO-driven branded search).
    const brandedByQuery = new Map<string, { query: string; clicks: number; impressions: number }>()
    for (const r of rows) {
      if (!isBrandedQuery(r.query, anchors)) continue
      const key = r.query.toLowerCase().trim()
      const agg = brandedByQuery.get(key) ?? { query: r.query, clicks: 0, impressions: 0 }
      agg.clicks += r.clicks
      agg.impressions += r.impressions
      brandedByQuery.set(key, agg)
    }
    const topBrandedQueries = [...brandedByQuery.values()]
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 20)

    return NextResponse.json({
      success: true,
      data: {
        anchors,
        summary,
        timeline,
        growth,
        aiAssist,
        topBrandedQueries,
        gscAvailable,
        filters: { days },
      },
      timestamp: Date.now(),
    })
  } catch (e) {
    logger.error('/api/gsc/branded-search failed', { err: e })
    return err('Failed to aggregate branded-search data')
  }
}
