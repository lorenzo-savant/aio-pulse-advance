import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { logger } from '@/lib/logger'
import { cached } from '@/lib/response-cache'

export const dynamic = 'force-dynamic'

// Recompute window. Health scores are written by the daily cron, so any value
// inside a 5-minute window is identical for the same (brand, period) pair.
// Lower this if you ever switch to real-time score recomputation.
const CACHE_TTL_SECONDS = 300

interface HealthScoreRow {
  health_score?: number | null
  visibility_score?: number | null
  sentiment_score?: number | null
  citation_rate?: number | null
  mention_count?: number | null
  position_avg?: number | null
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const supabase = createServerClient()
  if (!supabase) {
    return NextResponse.json({ metrics: getDefaultMetrics() })
  }

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const period = searchParams.get('period') || '30d'

  if (!brandId) {
    return NextResponse.json({ success: false, message: 'brand_id is required' }, { status: 400 })
  }
  if (!(await verifyBrandAccess(brandId, userId))) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
  }

  const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : period === '60d' ? 60 : 90
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysBack)

  try {
    // Cache by (brand, period). The query result depends ONLY on these two
    // inputs — adding userId to the key would defeat the cache (every user
    // gets their own copy of the same data). Brand-level access was already
    // validated via verifyBrandAccess above, so the cache key doesn't carry
    // authorization information.
    const cacheKey = `health-scores:${brandId}:${period}`

    const data = await cached({ key: cacheKey, ttlSeconds: CACHE_TTL_SECONDS }, async () => {
      const query = (supabase as any)
        .from('brand_health_scores')
        .select('*')
        .eq('brand_id', brandId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false })

      const { data, error } = await query.limit(100)
      if (error) throw error
      return (data ?? []) as HealthScoreRow[]
    })

    if (!data || data.length === 0) {
      return NextResponse.json({ metrics: getDefaultMetrics() })
    }

    const current = (data[0] || {}) as HealthScoreRow
    const previous = (data.length > 1 ? data[1] : data[0]) as HealthScoreRow

    const calcChange = (curr: number | null | undefined, prev: number | null | undefined) => {
      const c = curr || 0
      const p = prev || 0
      if (p === 0) return 0
      return ((c - p) / p) * 100
    }

    const getStatus = (value: number, thresholds: [number, number, number]) => {
      if (value >= thresholds[0]) return 'excellent' as const
      if (value >= thresholds[1]) return 'good' as const
      if (value >= thresholds[2]) return 'fair' as const
      return 'poor' as const
    }

    const metrics = [
      {
        name: 'Health Score',
        current: current.health_score || 0,
        previous: previous.health_score || 0,
        change: calcChange(current.health_score, previous.health_score),
        status: getStatus(current.health_score || 0, [0.8, 0.6, 0.4]),
      },
      {
        name: 'Visibility',
        current: current.visibility_score || 0,
        previous: previous.visibility_score || 0,
        change: calcChange(current.visibility_score, previous.visibility_score),
        status: getStatus(current.visibility_score || 0, [0.7, 0.5, 0.3]),
      },
      {
        name: 'Sentiment',
        current: current.sentiment_score || 0,
        previous: previous.sentiment_score || 0,
        change: calcChange(current.sentiment_score, previous.sentiment_score),
        status: getStatus(current.sentiment_score || 0, [0.7, 0.5, 0.3]),
      },
      {
        name: 'Citation Rate',
        current: current.citation_rate || 0,
        previous: previous.citation_rate || 0,
        change: calcChange(current.citation_rate, previous.citation_rate),
        status: getStatus(current.citation_rate || 0, [0.6, 0.4, 0.2]),
      },
      {
        name: 'Mentions',
        current: current.mention_count || 0,
        previous: previous.mention_count || 0,
        change: calcChange(current.mention_count, previous.mention_count),
        status: getStatus(current.mention_count || 0, [50, 20, 5]),
      },
      {
        name: 'Avg Position',
        current: current.position_avg || 0,
        previous: previous.position_avg || 0,
        change: calcChange(current.position_avg, previous.position_avg) * -1,
        status: getStatus(current.position_avg || 0, [3, 5, 10]),
      },
    ]

    return NextResponse.json({ metrics })
  } catch (err) {
    logger.error('Health scores API error', { err })
    return NextResponse.json({ metrics: getDefaultMetrics() }, { status: 500 })
  }
}

function getDefaultMetrics() {
  return [
    { name: 'Health Score', current: 0, previous: 0, change: 0, status: 'fair' as const },
    { name: 'Visibility', current: 0, previous: 0, change: 0, status: 'fair' as const },
    { name: 'Sentiment', current: 0, previous: 0, change: 0, status: 'fair' as const },
    { name: 'Citation Rate', current: 0, previous: 0, change: 0, status: 'fair' as const },
    { name: 'Mentions', current: 0, previous: 0, change: 0, status: 'fair' as const },
    { name: 'Avg Position', current: 0, previous: 0, change: 0, status: 'fair' as const },
  ]
}
