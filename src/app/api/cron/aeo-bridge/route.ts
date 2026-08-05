import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { aggregateBrandData, buildAeoReportJson, sendToAeo } from '@/lib/aeo-bridge'
import { verifyCronAuth } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
// 5 minutes - requires Vercel Pro plan (Hobby: 10s limit)
export const maxDuration = 300

interface BrandResult {
  brandId: string
  brandName: string
  domain: string
  userId: string | null
  success: boolean
  runId?: string
  error?: string
  skipped?: boolean
  skipReason?: string
}

export async function POST(req: NextRequest) {
  const cronError = verifyCronAuth(req)
  if (cronError) return cronError

  // The bridge writes into a SEPARATE Supabase project (AEO_SUPABASE_*), and
  // neither credential is set. `sendToAeo` therefore returns "not configured"
  // for every brand — but only after this route has walked every active brand,
  // slept 500ms per brand, and run a 30-day aggregation query for each. Three
  // hundred seconds of budget spent, once a day, to produce a list of identical
  // failures nobody reads.
  //
  // Answer the question up front instead. This is the OFF state of an optional
  // integration, not a fault, so it reports success — with a message that says
  // plainly why nothing happened, which is what the daily log was failing to.
  if (!process.env['AEO_SUPABASE_URL'] || !process.env['AEO_SUPABASE_KEY']) {
    logger.info('AEO bridge not configured — skipping', {
      source: 'cron/aeo-bridge',
      hint: 'set AEO_SUPABASE_URL and AEO_SUPABASE_KEY to enable',
    })
    return NextResponse.json({
      success: true,
      skipped: true,
      message: 'AEO bridge disabled: AEO_SUPABASE_URL / AEO_SUPABASE_KEY not configured',
      processed: 0,
    })
  }

  const db = createServerClient()
  if (!db) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  const { data: brands, error } = await db
    .from('brands')
    .select('id, name, domain, competitors, industry, aliases, color, user_id')
    .eq('is_active', true)
    .is('deleted_at', null)
    .not('domain', 'is', null)
    .order('created_at', { ascending: true })

  if (error || !brands?.length) {
    return NextResponse.json({
      success: true,
      message: 'No active brands with domain found',
      processed: 0,
    })
  }

  const results: BrandResult[] = []

  for (const brand of brands) {
    await new Promise((r) => setTimeout(r, 500))

    try {
      const data = await aggregateBrandData(brand.id, 30)

      if (data.results.length === 0) {
        results.push({
          brandId: brand.id,
          brandName: brand.name,
          domain: brand.domain ?? '',
          userId: brand.user_id ?? null,
          success: false,
          skipped: true,
          skipReason: 'No monitoring results in last 30 days',
        })
        continue
      }

      const reportJson = buildAeoReportJson({
        brand: brand as unknown as Record<string, unknown>,
        ...data,
        dateRangeDays: 30,
        trigger: 'cron',
      })

      const result = await sendToAeo({
        clientDomain: brand.domain ?? '',
        reportJson,
        aioVisibilityScore: reportJson.visibility.ai_score,
      })

      results.push({
        brandId: brand.id,
        brandName: brand.name,
        domain: brand.domain ?? '',
        userId: brand.user_id ?? null,
        success: result.success,
        runId: result.runId,
        error: result.error,
      })

      logger.info('Brand processed', {
        source: 'cron/aeo-bridge',
        userId: (brand.user_id ?? 'unknown').slice(0, 8),
        brand: brand.name,
        domain: brand.domain ?? '',
        success: result.success,
        runId: result.runId,
        error: result.error,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('Error for brand', { source: 'cron/aeo-bridge', brand: brand.name, error: msg })
      results.push({
        brandId: brand.id,
        brandName: brand.name,
        domain: brand.domain ?? '',
        userId: brand.user_id ?? null,
        success: false,
        error: msg,
      })
    }
  }

  const succeeded = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success && !r.skipped).length
  const skipped = results.filter((r) => r.skipped).length

  const byUser: Record<string, number> = {}
  for (const r of results) {
    if (r.success && r.userId) {
      byUser[r.userId] = (byUser[r.userId] ?? 0) + 1
    }
  }

  logger.info('Cron complete', {
    source: 'cron/aeo-bridge',
    succeeded,
    failed,
    skipped,
    uniqueUsers: Object.keys(byUser).length,
  })

  return NextResponse.json({
    success: true,
    message: `AEO Bridge cron complete: ${succeeded} sent, ${failed} failed, ${skipped} skipped`,
    trigger: 'cron',
    summary: {
      succeeded,
      failed,
      skipped,
      total: brands.length,
      unique_users: Object.keys(byUser).length,
    },
    results,
  })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
