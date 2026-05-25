// PATH: src/app/api/editorial-outlets/route.ts
//
// GET /api/editorial-outlets?brand_id=...&days=180&limit=15
//
// Returns a leaderboard of editorial publications the AI engines have
// cited for the brand over the window, with per-engine breakdown. The
// operator uses this as a PR target list — pitch the outlets the
// engines already trust in your space.
//
// Reuses cited_urls already on monitoring_results (same source as
// /api/citation-categories) — no extra outbound calls.

import { type NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { createServerClient } from '@/lib/supabase'
import { buildEditorialOutletLeaderboard } from '@/lib/utils/editorial-outlets'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const brandId = req.nextUrl.searchParams.get('brand_id')
  const days = Math.min(720, Math.max(7, Number(req.nextUrl.searchParams.get('days')) || 180))
  const limit = Math.min(50, Math.max(5, Number(req.nextUrl.searchParams.get('limit')) || 15))
  if (!brandId) return err('brand_id is required', 400)
  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) return err('Forbidden', 403)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const since = new Date()
  since.setDate(since.getDate() - days)

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data, error } = await (db as any)
    .from('monitoring_results')
    .select('engine, cited_urls')
    .eq('brand_id', brandId)
    .gte('created_at', since.toISOString())
    .not('cited_urls', 'is', null)
    .limit(5000)
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (error) {
    logger.error('/api/editorial-outlets failed', { err: String(error) })
    return err('Failed to load citation data')
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data: brandRow } = await (db as any)
    .from('brands')
    .select('domain, domains')
    .eq('id', brandId)
    .single()
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const brandDomains: string[] = [
    ...((brandRow?.domain as string | null) ? [brandRow.domain as string] : []),
    ...(Array.isArray(brandRow?.domains) ? (brandRow.domains as string[]) : []),
  ]

  const rows = ((data ?? []) as Array<{ engine: string; cited_urls: string[] | null }>).map(
    (r) => ({
      engine: r.engine,
      citedUrls: r.cited_urls ?? [],
    }),
  )

  const leaderboard = buildEditorialOutletLeaderboard(rows, { limit, brandDomains })

  return NextResponse.json({
    success: true,
    data: { ...leaderboard, filters: { days, limit } },
    timestamp: Date.now(),
  })
}
