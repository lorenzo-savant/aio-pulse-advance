import { NextRequest, NextResponse } from 'next/server'
import { syncAllBrandsGsc } from '@/lib/services/gsc-sync'
import { verifyCronAuth } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const cronError = verifyCronAuth(req)
  if (cronError) return cronError

  try {
    const result = await syncAllBrandsGsc()

    logger.info('GSC sync cron complete', result)

    return NextResponse.json({
      success: true,
      message: `GSC sync complete: ${result.success} brands synced, ${result.failed} failed, ${result.totalRows} rows`,
      brandsSynced: result.success,
      brandsFailed: result.failed,
      rowsSynced: result.totalRows,
    })
  } catch (error) {
    logger.error('GSC sync cron failed', { error: String(error) })
    return NextResponse.json({ success: false, message: 'GSC sync failed' }, { status: 500 })
  }
}
