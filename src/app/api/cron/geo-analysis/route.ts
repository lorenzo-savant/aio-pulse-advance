// PATH: src/app/api/cron/geo-analysis/route.ts
//
// Weekly GEO Score snapshot + alert trigger for every brand.
//
// Scheduled by Vercel Cron at 05:00 UTC every Monday (see vercel.json).
// Vercel cron uses GET — POST is kept for manual invocation. They share
// the same handler.
//
// Manual usage:
//   curl -X POST https://aio-pulse.com/api/cron/geo-analysis \
//     -H "Authorization: Bearer $CRON_SECRET_TOKEN"
//
//   # backfill last 14 days for every brand (formula migration use case):
//   curl -X POST "https://aio-pulse.com/api/cron/geo-analysis?backfill=true&days=14" \
//     -H "Authorization: Bearer $CRON_SECRET_TOKEN"

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'
import {
  precomputeAllGeoSnapshots,
  backfillGeoSnapshots,
} from '@/lib/services/geo-score-precompute'

export const dynamic = 'force-dynamic'
// Up to 60s — large brand portfolios + alert dispatch fan-out can exceed
// the 10s default on Vercel hobby/pro functions.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  const startedAt = Date.now()
  const url = new URL(req.url)
  const backfill = url.searchParams.get('backfill') === 'true'
  const days = parseInt(url.searchParams.get('days') ?? '7', 10)

  try {
    if (backfill) {
      // Bulk re-scoring path — re-snapshot the last N days for every brand.
      // Used after GEO formula changes (new pillar, weight rebalance, etc.)
      // so historical chart data reflects the new math.
      const { daysProcessed, runs } = await backfillGeoSnapshots(days)
      const totalSnapshots = runs.reduce((acc, r) => acc + r.succeeded, 0)
      const totalAlerts = runs.reduce((acc, r) => acc + r.alertsDispatched, 0)
      const totalErrors = runs.reduce((acc, r) => acc + r.failed, 0)

      logger.info('GEO backfill complete', {
        service: 'cron-geo-analysis',
        daysProcessed,
        totalSnapshots,
        totalAlerts,
        totalErrors,
        durationMs: Date.now() - startedAt,
      })

      return NextResponse.json({
        success: true,
        mode: 'backfill',
        daysProcessed,
        totalSnapshots,
        totalAlerts,
        totalErrors,
        durationMs: Date.now() - startedAt,
      })
    }

    // Default path — single snapshot per brand for today.
    const report = await precomputeAllGeoSnapshots()
    return NextResponse.json({
      success: true,
      mode: 'snapshot',
      processed: report.processed,
      succeeded: report.succeeded,
      failed: report.failed,
      alertsDispatched: report.alertsDispatched,
      durationMs: Date.now() - startedAt,
      // Trim payload — full snapshot/error list would balloon the response
      // for large workspaces. The detail is in the snapshot table + Sentry.
      sampleSnapshots: report.snapshots.slice(0, 5),
      sampleErrors: report.errors.slice(0, 5),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('GEO analysis cron failed', { service: 'cron-geo-analysis', err: msg })
    return NextResponse.json({ success: false, message: msg }, { status: 500 })
  }
}

// Vercel Cron triggers via HTTP GET. Alias GET to POST so the same
// handler runs whether the scheduler hits it or a human triggers it
// manually via authenticated POST.
export const GET = POST
