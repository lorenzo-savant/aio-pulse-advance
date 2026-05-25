// PATH: src/app/api/citations/engine-format/route.ts
//
// GET /api/citations/engine-format?brand_id=…&days=30&owned=1
//
// "Which AI engine prefers which content format from my domain?"
//
// Reads monitoring_results.cited_urls + engine for the brand+window and
// runs computeEngineFormatAffinity. When ?owned=1 (default), restricts
// the count to URLs on the brand's owned domain — the typical use case
// per Semrush ("the fix was to rewrite their pages in forms each LLM
// would prefer"). When ?owned=0, counts every cited URL.
//
// Pure aggregation, no new external API.

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { computeEngineFormatAffinity } from '@/lib/utils/engine-format-affinity'
import { logger } from '@/lib/logger'
import type { Brand } from '@/types'

export const dynamic = 'force-dynamic'

interface ResultRow {
  cited_urls: string[] | null
  engine: string | null
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
  const ownedOnly = searchParams.get('owned') !== '0' // default = restrict to owned

  if (!brandId) return err('brand_id is required', 400)

  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  const b = brand as Brand
  const ownedDomain = ownedOnly ? (b.domain ?? b.domains?.[0] ?? '').trim().toLowerCase() : null
  // If the caller wants owned-only but the brand has no domain, return an
  // empty report with a clear reason rather than counting external sources.
  if (ownedOnly && !ownedDomain) {
    return NextResponse.json({
      success: true,
      data: {
        scope: 'owned',
        report: { engines: [], formatLeaders: [], totalCitations: 0 },
        reason: 'Brand has no owned domain — pass ?owned=0 to analyse all citations.',
      },
      timestamp: Date.now(),
    })
  }
  const ownedHost = ownedDomain
    ? (ownedDomain
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0] ?? '')
    : null

  const since = new Date()
  since.setDate(since.getDate() - days)

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const { data, error } = await (db as any)
      .from('monitoring_results')
      .select('cited_urls, engine, created_at')
      .eq('brand_id', brandId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(5000)
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (error) {
      logger.error('/api/citations/engine-format query failed', { err: error })
      return err('Failed to load citation data')
    }

    const rows = (data || []) as ResultRow[]
    const report = computeEngineFormatAffinity(rows, {
      ownedDomain: ownedHost || undefined,
    })

    return NextResponse.json({
      success: true,
      data: {
        scope: ownedHost ? 'owned' : 'all',
        ownedDomain: ownedHost,
        filters: { days },
        report,
      },
      timestamp: Date.now(),
    })
  } catch (e) {
    logger.error('/api/citations/engine-format failed', { err: e })
    return err('Failed to analyse engine × format affinity')
  }
}
