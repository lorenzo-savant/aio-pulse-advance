// PATH: src/app/api/fan-out/route.ts
//
// Query fan-out — the searches the engines actually ran for a brand's prompts.
//
// Read-only aggregation over monitoring_results.search_queries. The heavy
// lifting is a pure function (services/fan-out.ts) so this route stays an
// assembler: fetch rows the caller may see, hand them to the reducer, return.

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { buildFanOutReport, type FanOutRow } from '@/lib/services/fan-out'
import { isActiveEngine } from '@/types'
import { providerMatchesEngine } from '@/lib/services/engine-provenance'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// ─── GET /api/fan-out?brand_id=…&days=30 ────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  if (!brandId) return err('brand_id is required', 400)

  // Same clamp as the report route: parseInt on a non-numeric value yields NaN
  // and `new Date(NaN).toISOString()` throws a bare 500.
  const daysRaw = Number(searchParams.get('days') || 30)
  const days = Number.isFinite(daysRaw) ? Math.min(365, Math.max(1, Math.trunc(daysRaw))) : 30

  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  const supabase = createServerClient()
  if (!supabase) return err('Database not configured', 503)

  const fromDate = new Date(Date.now() - days * 86_400_000).toISOString()

  const { data, error } = await supabase
    .from('monitoring_results')
    .select('engine, search_queries, brand_mentioned, cited_urls, response_provider, prompt_text')
    .eq('brand_id', brandId)
    .gte('created_at', fromDate)
    .limit(5000)

  if (error) {
    logger.error('Fan-out query failed', { service: 'fan-out', error: error.message })
    return err('Failed to load fan-out data')
  }

  const rows = (data ?? []) as Array<FanOutRow & { response_provider?: string | null }>

  // Same two filters the per-engine surfaces use: a retired engine is not
  // presented, and a row served by another provider is not a measurement of
  // the engine it was requested for (engine-provenance.ts).
  const scoped: FanOutRow[] = rows.filter(
    (r) => isActiveEngine(r.engine) && providerMatchesEngine(r.engine, r.response_provider),
  )

  const report = buildFanOutReport(scoped, {
    ownDomain: (brand as { domain?: string | null }).domain ?? null,
    limit: 100,
  })

  return NextResponse.json({
    success: true,
    data: {
      ...report,
      windowDays: days,
      // Surfaced so the UI can state coverage honestly rather than implying
      // the ranking covers every run.
      totalRows: scoped.length,
    },
  })
}
