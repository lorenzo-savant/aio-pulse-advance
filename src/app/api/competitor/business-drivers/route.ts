// PATH: src/app/api/competitor/business-drivers/route.ts
//
// GET /api/competitor/business-drivers?brand_id=…&days=30
//
// "Who owns which narrative attribute?"
//
// Reads monitoring_results.response_text + competitor_mentions for the
// brand+window, runs extractBusinessDrivers to build a brand × driver
// matrix (pricing / speed / quality / support / features / value /
// reliability / ease_of_use), and surfaces:
//   - the leader per driver (the "trophy")
//   - the brand's narrative gaps (drivers a competitor leads on)
//
// Pure aggregation. No external API.

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import {
  extractBusinessDrivers,
  findNarrativeGaps,
  type MonitoringRowForDrivers,
} from '@/lib/utils/business-drivers'
import { logger } from '@/lib/logger'
import type { Brand } from '@/types'

export const dynamic = 'force-dynamic'

interface ResultRow {
  brand_mentioned: boolean | null
  response_text: string | null
  competitor_mentions: Array<{ name?: string | null }> | null
  created_at: string
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
  const days = Math.min(365, Math.max(7, Number(searchParams.get('days')) || 30))

  if (!brandId) return err('brand_id is required', 400)

  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  const since = new Date()
  since.setDate(since.getDate() - days)

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const { data, error } = await (db as any)
      .from('monitoring_results')
      .select('brand_mentioned, response_text, competitor_mentions, created_at')
      .eq('brand_id', brandId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(2000)
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (error) {
      logger.error('/api/competitor/business-drivers query failed', { err: error })
      return err('Failed to load monitoring data')
    }

    const rows = ((data || []) as ResultRow[]).map<MonitoringRowForDrivers>((r) => ({
      brand_mentioned: r.brand_mentioned,
      response_text: r.response_text,
      competitor_mentions: r.competitor_mentions,
    }))
    const b = brand as Brand
    const competitors = Array.isArray(b.competitors) ? b.competitors : []
    const report = extractBusinessDrivers(rows, b.name, competitors)
    const gaps = findNarrativeGaps(report)

    return NextResponse.json({
      success: true,
      data: {
        report,
        gaps,
        filters: { days },
      },
      timestamp: Date.now(),
    })
  } catch (e) {
    logger.error('/api/competitor/business-drivers failed', { err: e })
    return err('Failed to extract business drivers')
  }
}
