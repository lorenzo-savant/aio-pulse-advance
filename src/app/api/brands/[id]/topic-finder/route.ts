// PATH: src/app/api/brands/[id]/topic-finder/route.ts
//
// GET → ranked content topics derived from the brand's CitationCapture
// gap list. Reuses citation-capture's pure compute layer + the new
// topic-finder clustering on top. Same homonym-confusion filter applies.

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import {
  buildOwnedDomainSet,
  computeCitationCapture,
  type CaptureInputRow,
} from '@/lib/services/citation-capture'
import { findTopics } from '@/lib/services/topic-finder'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params

  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const brand = await verifyBrandAccess(id, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  const ip = getClientIp(req.headers)
  const rate = await checkRateLimit(`topic-finder:${ip}`, 30, 60_000)
  if (!rate.success) return err('Rate limit exceeded', 429)

  const { searchParams } = new URL(req.url)
  const days = Math.min(365, Math.max(1, Number(searchParams.get('days')) || 60))
  const minClusterSize = Math.max(2, Number(searchParams.get('min_cluster_size')) || 2)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const brandWithDomains = brand as { domain?: string | null; domains?: string[] | null }
  const ownedDomains = buildOwnedDomainSet(
    brandWithDomains.domain ?? null,
    brandWithDomains.domains ?? null,
  )

  const since = new Date()
  since.setDate(since.getDate() - days)

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const dbAny = db as unknown as ReturnType<typeof createServerClient> & {
      from: (t: string) => any
    }
    async function fetchRows(applyConfusionFilter: boolean) {
      let q = dbAny
        .from('monitoring_results')
        .select('id, engine, prompt_text, cited_urls, brand_mentioned, created_at')
        .eq('brand_id', id)
        .eq('brand_mentioned', true)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(5000)
      if (applyConfusionFilter) q = q.neq('confusion_flag', true)
      return q
    }

    let res = await fetchRows(true)
    if (res.error && /confusion_flag/i.test(res.error.message || '')) {
      res = await fetchRows(false)
    }
    const { data, error } = res
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (error) {
      logger.error('/api/topic-finder query failed', { err: error })
      return err('Failed to load gap data for topic clustering')
    }

    const rows = (data ?? []) as CaptureInputRow[]
    // Use the existing capture computation to get the gap list with
    // citedInstead hosts already resolved. We feed its gapList through
    // the topic finder. gapLimit is high so we don't truncate before
    // clustering.
    const capture = computeCitationCapture(rows, ownedDomains, { gapLimit: 5000 })
    const report = findTopics(
      capture.gapList.map((g) => ({
        prompt_text: g.prompt_text,
        engine: g.engine,
        citedInstead: g.citedInstead,
      })),
      { minClusterSize, maxClusters: 12 },
    )

    return NextResponse.json({
      success: true,
      data: {
        ...report,
        brand: { id: brand.id, name: brand.name },
        filters: { days, minClusterSize },
      },
      timestamp: Date.now(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('/api/topic-finder failed', { err: msg })
    return err(msg)
  }
}
