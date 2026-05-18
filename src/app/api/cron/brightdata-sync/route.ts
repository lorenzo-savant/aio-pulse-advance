import { NextRequest, NextResponse } from 'next/server'
import { scrapeAllBrands } from '@/lib/services/brightdata-sync'
import { verifyCronAuth } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const cronError = verifyCronAuth(req)
  if (cronError) return cronError

  try {
    const result = await scrapeAllBrands()

    logger.info('Bright Data sync cron complete', result)

    return NextResponse.json({
      success: true,
      message: `Bright Data sync complete: ${result.success} brands scraped, ${result.failed} failed, ${result.totalScrapes} total scrapes`,
      brandsScraped: result.success,
      brandsFailed: result.failed,
      totalScrapes: result.totalScrapes,
    })
  } catch (error) {
    logger.error('Bright Data sync cron failed', { error: String(error) })
    return NextResponse.json(
      { success: false, message: 'Bright Data sync failed' },
      { status: 500 },
    )
  }
}
