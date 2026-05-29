import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { refreshAllBrandKeywords } from '@/lib/services/keyword-refresh'
import { verifyCronAuth } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const cronError = verifyCronAuth(req)
  if (cronError) return cronError

  try {
    const result = await refreshAllBrandKeywords()

    logger.info('Keyword refresh cron complete', result)

    return NextResponse.json({
      success: true,
      message: `Keyword refresh complete: ${result.success} brands updated, ${result.failed} failed, ${result.totalKeywords} keywords`,
      brandsUpdated: result.success,
      brandsFailed: result.failed,
      keywordsUpdated: result.totalKeywords,
    })
  } catch (error) {
    logger.error('Keyword refresh cron failed', { error: String(error) })
    return NextResponse.json({ success: false, message: 'Keyword refresh failed' }, { status: 500 })
  }
}

// Vercel Cron triggers via HTTP GET. Alias GET to POST so the same
// handler runs whether the scheduler hits it or a human triggers it
// manually via authenticated POST.
export const GET = POST
