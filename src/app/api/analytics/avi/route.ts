// PATH: src/app/api/analytics/avi/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getAccessibleBrandIds } from '@/lib/authorize'
import { requireUser } from '@/lib/api-auth'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { cached } from '@/lib/response-cache'
import { logger } from '@/lib/logger'

const EMPTY_AVI = {
  avi: 0,
  delta: 0,
  components: {
    citationRate: 0,
    mentionRate: 0,
    sentimentScore: 0,
    recommendationRate: 0,
    positionAvg: 0,
    hallucinationRate: 0,
  },
  previousAvi: 0,
}

export async function GET(req: NextRequest) {
  // getCurrentUserId THROWS AuthError on failure (never returns falsy), so the
  // old `if (!userId)` guard was dead code → an unauth request surfaced as a
  // 500 instead of 401. requireUser catches AuthError and returns a clean 401.
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`analytics-avi:${ip}`, 30, 60_000)
  if (!rateCheck.success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
      },
    )
  }

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brandId')

  const db = createServerClient()
  if (!db) {
    return NextResponse.json(EMPTY_AVI)
  }

  // The underlying health score changes only when a monitoring scan lands
  // (every 6-8h), but the dashboard polls this endpoint on every refresh —
  // a 5 min cache collapses that to one DB round-trip per lifetime. The key
  // encodes user + brand (personalized data).
  const payload = await cached<typeof EMPTY_AVI & { date?: string | null }>(
    {
      key: `avi:${userId}:${brandId ?? 'all'}`,
      ttlSeconds: 300,
      // Never persist the empty payload. It is returned both for a genuine
      // "no scans yet" AND (via the guard below) for a transient DB failure —
      // freezing either into Redis pins the product's headline metric at 0 for
      // the full TTL, unfixable by refresh. A brand whose first scan just
      // landed would keep reading 0 for five minutes.
      shouldCache: (v) => v !== EMPTY_AVI,
    },
    async () => {
      // A health score describes a BRAND, so it is readable by everyone who can
      // read that brand. Scoping it to `user_id` meant a collaborator's AVI
      // widget showed 0 for a brand whose score was sitting in the table.
      const accessibleBrandIds = await getAccessibleBrandIds(db, userId)
      if (brandId && !accessibleBrandIds.includes(brandId)) return EMPTY_AVI

      const scope = brandId ? [brandId] : accessibleBrandIds
      if (scope.length === 0) return EMPTY_AVI

      // Get latest health score
      const query = db
        .from('brand_health_scores')
        .select('*')
        .in('brand_id', scope)
        .order('date', { ascending: false })
        .limit(1)

      const { data: latest, error: latestError } = await query

      // A DB failure is NOT "this brand has no data" — surface it so the
      // outage is visible, and let shouldCache keep it out of Redis.
      if (latestError) {
        logger.error('AVI query failed', {
          source: 'analytics/avi',
          err: latestError.message,
        })
        return EMPTY_AVI
      }
      if (!latest?.length) {
        return EMPTY_AVI
      }

      const current = latest[0]!

      // Get previous period score (7 days ago)
      const prevDate = new Date()
      prevDate.setDate(prevDate.getDate() - 7)

      const prevQuery = db
        .from('brand_health_scores')
        .select('avi_score, health_score')
        .in('brand_id', scope)
        .lte('date', prevDate.toISOString().split('T')[0] ?? '')
        .order('date', { ascending: false })
        .limit(1)

      const { data: prev } = await prevQuery
      const previousAvi = prev?.[0]?.avi_score ?? prev?.[0]?.health_score ?? 0
      const currentAvi = current.avi_score ?? current.health_score ?? 0

      return {
        avi: currentAvi,
        delta: Math.round((currentAvi - previousAvi) * 10) / 10,
        components: {
          citationRate: current.citation_rate ?? 0,
          mentionRate: current.mention_rate ?? current.visibility_score ?? 0,
          sentimentScore: current.sentiment_score ?? 0,
          recommendationRate: current.recommendation_rate ?? 0,
          positionAvg: current.position_avg ?? 0,
          hallucinationRate: (current.hallucination_rate ?? 0) * 100,
        },
        previousAvi,
        date: current.date,
      }
    },
  )

  return NextResponse.json(payload)
}
