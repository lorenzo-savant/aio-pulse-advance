// PATH: src/app/api/citation-categories/route.ts
//
// Breaks down the brand's AI citations into seven source categories
// (first_party, review_site, community, encyclopedia, editorial,
// social, aggregator, other) so the operator can see WHICH KIND of
// third-party source each engine prefers for their brand. Reads
// cited_urls we already store on monitoring_results — no extra API
// calls.

import { type NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { createServerClient } from '@/lib/supabase'
import { buildCitationSourceBreakdown } from '@/lib/utils/citation-source-category'
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
    logger.error('/api/citation-categories failed', { err: String(error) })
    return err('Failed to load citation data')
  }

  // Collect brand-owned domains so first-party citations get bucketed
  // correctly. `domain` is the legacy single field, `domains` is the
  // newer text[]; both can coexist.
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

  const breakdown = buildCitationSourceBreakdown(rows, brandDomains)

  return NextResponse.json({
    success: true,
    data: { ...breakdown, brandDomains, filters: { days } },
    timestamp: Date.now(),
  })
}
