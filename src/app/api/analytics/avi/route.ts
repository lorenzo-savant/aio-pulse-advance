// PATH: src/app/api/analytics/avi/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cookieHeader = req.headers.get('cookie')
  const userId = await getCurrentUserId(authHeader, cookieHeader, req)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brandId')

  const db = createServerClient()
  if (!db) {
    return NextResponse.json({
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
    })
  }

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
    return NextResponse.json({
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
    })
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

  return NextResponse.json({
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
  })
}
