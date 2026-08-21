// PATH: src/app/api/fan-out/runs/route.ts
//
// The runs behind one fan-out search — the evidence layer under /api/fan-out.
//
// The parent route returns a ranking: which searches the engines ran and how
// often the brand appeared in them. It deliberately drops the answers, because
// a ranking that carried every response text would be megabytes. This route is
// the other half: pick one search, get back the individual runs that contained
// it, each with the engine's answer, the sources it cited, and the sibling
// searches the same run fired.
//
// Fetched in two passes on purpose. Pass one reads only the columns needed to
// decide which rows match (search_queries, engine, provenance, timestamp) —
// cheap over a 30-day window. Pass two reads the heavy text for at most
// `limit` rows. Filtering on the fan-out array in Postgres was rejected: array
// containment is exact-string, while the ranking groups by fanOutKey (case and
// whitespace folded), so the two surfaces would disagree about which runs
// belong to a search. Matching in one place keeps them identical.

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import {
  fanOutKey,
  rowMatchesFanOut,
  selectRunsForQuery,
  type FanOutRunRow,
} from '@/lib/services/fan-out'
import { isActiveEngine } from '@/types'
import { providerMatchesEngine } from '@/lib/services/engine-provenance'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/** Upper bound on runs returned in one call. Each carries up to 6 000
 *  characters of answer, so this is the payload ceiling as much as a UI one. */
const MAX_RUNS = 50
const DEFAULT_RUNS = 25

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

function clamp(raw: string | null, fallback: number, min: number, max: number): number {
  const n = Number(raw ?? fallback)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

// ─── GET /api/fan-out/runs?brand_id=…&query=…&days=30&limit=25 ───────────────
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  if (!brandId) return err('brand_id is required', 400)

  const query = (searchParams.get('query') ?? '').trim()
  if (!query) return err('query is required', 400)
  // Bounded before it reaches the matcher: the key is only ever compared
  // against stored queries, which are capped at 300 characters on write.
  if (query.length > 300) return err('query is too long', 400)

  const days = clamp(searchParams.get('days'), 30, 1, 365)
  const limit = clamp(searchParams.get('limit'), DEFAULT_RUNS, 1, MAX_RUNS)

  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  const supabase = createServerClient()
  if (!supabase) return err('Database not configured', 503)

  const fromDate = new Date(Date.now() - days * 86_400_000).toISOString()
  const key = fanOutKey(query)

  // Pass 1 — which rows match, cheaply.
  const { data: index, error: indexError } = await supabase
    .from('monitoring_results')
    .select('id, engine, response_provider, created_at, search_queries')
    .eq('brand_id', brandId)
    .gte('created_at', fromDate)
    .not('search_queries', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (indexError) {
    logger.error('Fan-out runs index query failed', {
      service: 'fan-out',
      error: indexError.message,
    })
    return err('Failed to load runs')
  }

  // Same two filters as the ranking: a retired engine is not presented, and a
  // row served by another provider is not a measurement of the engine it was
  // requested for (engine-provenance.ts).
  const matching = (index ?? []).filter(
    (r) =>
      isActiveEngine(r.engine) &&
      providerMatchesEngine(r.engine, r.response_provider) &&
      rowMatchesFanOut(r.search_queries, key),
  )

  const total = matching.length
  const ids = matching.slice(0, limit).map((r) => r.id)

  if (ids.length === 0) {
    return NextResponse.json({
      success: true,
      data: { query, runs: [], total: 0, windowDays: days },
    })
  }

  // Pass 2 — the evidence, for those rows only.
  const { data: rows, error: rowsError } = await supabase
    .from('monitoring_results')
    .select(
      'id, engine, created_at, prompt_text, response_text, cited_urls, brand_mentioned, search_queries',
    )
    .eq('brand_id', brandId)
    .in('id', ids)

  if (rowsError) {
    logger.error('Fan-out runs detail query failed', {
      service: 'fan-out',
      error: rowsError.message,
    })
    return err('Failed to load runs')
  }

  const runs = selectRunsForQuery((rows ?? []) as FanOutRunRow[], query, {
    ownDomain: (brand as { domain?: string | null }).domain ?? null,
    limit,
  })

  return NextResponse.json({
    success: true,
    data: {
      query,
      runs,
      // `total` is the match count before the cap, so the UI can say "25 of 68"
      // instead of implying the panel holds everything.
      total,
      windowDays: days,
    },
  })
}
