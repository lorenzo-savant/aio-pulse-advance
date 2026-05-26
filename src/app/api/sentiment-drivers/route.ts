// PATH: src/app/api/sentiment-drivers/route.ts
//
// GET /api/sentiment-drivers?brand_id=…&days=30&min_mentions=2
//
// "Which aspects drive positive vs negative AI portrayal of MY brand?"
// Pure aggregation over monitoring_results.response_text — no new API key,
// no new dependency. See src/lib/services/sentiment-drivers.ts for logic.

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { logger } from '@/lib/logger'
import { extractSentimentDrivers, type SentimentDriverRow } from '@/lib/services/sentiment-drivers'

export const dynamic = 'force-dynamic'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const days = Math.min(365, Math.max(1, Number(searchParams.get('days')) || 30))
  const minMentions = Math.max(1, Number(searchParams.get('min_mentions')) || 2)
  const windowTokens = Math.min(80, Math.max(5, Number(searchParams.get('window')) || 25))

  if (!brandId) return err('brand_id is required', 400)

  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  const since = new Date()
  since.setDate(since.getDate() - days)

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const dbAny = db as unknown as ReturnType<typeof createServerClient> & {
      from: (t: string) => any
    }
    // Filter out homonym-confusion rows (audit verdict: not actually about
    // THIS brand). Falls back to unfiltered when the column isn't present
    // yet — keeps the panel working before the migration is applied.
    const brandIdNonNull: string = brandId
    async function fetchRows(applyConfusionFilter: boolean) {
      let q = dbAny
        .from('monitoring_results')
        .select('id, brand_mentioned, response_text, sentiment_score, created_at')
        .eq('brand_id', brandIdNonNull)
        .eq('brand_mentioned', true)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(2000)
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
      logger.error('/api/sentiment-drivers query failed', { err: error })
      return err('Failed to load sentiment-drivers data')
    }

    const rows = (data ?? []) as SentimentDriverRow[]
    const result = extractSentimentDrivers(rows, brand.name, {
      minMentions,
      windowTokens,
      aliases: brand.aliases ?? [],
    })

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        filters: { days, minMentions, windowTokens },
        brand: { id: brand.id, name: brand.name },
      },
      timestamp: Date.now(),
    })
  } catch (e) {
    logger.error('/api/sentiment-drivers error', { err: String(e) })
    return err('Failed to compute sentiment drivers')
  }
}
