// PATH: src/app/api/brands/[id]/citation-capture/route.ts
//
// GET → per-engine "Citation Capture Rate" report: how often does the AI
// cite the brand's OWN domain on prompts that mention the brand by name?
// Low rate = the AI knows about you but doesn't think your site is the
// authoritative source. Direct port of industry research "Domain doesn't rank
// in feature" filter, applied to AI citations.
//
// Query params:
//   ?days=30       — window size, default 30, max 365
//   ?engine=all    — restrict to one engine (or `all`, default)

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
  const rate = await checkRateLimit(`citation-capture:${ip}`, 30, 60_000)
  if (!rate.success) return err('Rate limit exceeded', 429)

  const { searchParams } = new URL(req.url)
  const days = Math.min(365, Math.max(1, Number(searchParams.get('days')) || 30))
  const engine = searchParams.get('engine') ?? 'all'

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // Brand-context types vary across deploys (legal_id / domains columns
  // may or may not be present). Read defensively through `any`.
  const brandWithDomains = brand as {
    domain?: string | null
    domains?: string[] | null
  }
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
    // Filter homonym-confusion at the query level. Fall back to the
    // unfiltered query when the column doesn't exist (migration pending).
    async function fetchRows(applyConfusionFilter: boolean) {
      let q = dbAny
        .from('monitoring_results')
        .select('id, engine, prompt_text, cited_urls, brand_mentioned, created_at')
        .eq('brand_id', id)
        .eq('brand_mentioned', true)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(5000)
      if (engine !== 'all') q = q.eq('engine', engine)
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
      logger.error('/api/citation-capture query failed', { err: error })
      return err('Failed to load citation-capture data')
    }

    const rows = (data ?? []) as CaptureInputRow[]
    const report = computeCitationCapture(rows, ownedDomains, { gapLimit: 20 })

    return NextResponse.json({
      success: true,
      data: {
        ...report,
        brand: { id: brand.id, name: brand.name },
        ownedDomains: Array.from(ownedDomains),
        filters: { days, engine },
      },
      timestamp: Date.now(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('/api/citation-capture failed', { err: msg })
    return err(msg)
  }
}
