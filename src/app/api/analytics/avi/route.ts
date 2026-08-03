// PATH: src/app/api/analytics/avi/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { cached } from '@/lib/response-cache'

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
  const payload = await cached(
    { key: `avi:${userId}:${brandId ?? 'all'}`, ttlSeconds: 300 },
    async () => {
      // Get latest health score
      let query = db
        .from('brand_health_scores')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(1)

      if (brandId) {
        query = query.eq('brand_id', brandId)
      }

      const { data: latest, error: latestError } = await query

      if (latestError || !latest?.length) {
        return EMPTY_AVI
      }

      const current = latest[0]!

      // Get previous period score (7 days ago)
      const prevDate = new Date()
      prevDate.setDate(prevDate.getDate() - 7)

      let prevQuery = db
        .from('brand_health_scores')
        .select('avi_score, health_score')
        .eq('user_id', userId)
        .lte('date', prevDate.toISOString().split('T')[0] ?? '')
        .order('date', { ascending: false })
        .limit(1)

      if (brandId) {
        prevQuery = prevQuery.eq('brand_id', brandId)
      }

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
