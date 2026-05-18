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
