import { type NextRequest, NextResponse } from 'next/server'
import { hashApiKey, rateLimitCheck, getRateLimitResetAt } from '@/lib/services/public-api'
import { createServerClient } from '@/lib/supabase'

async function verifyApiKey(apiKey: string): Promise<string | null> {
  const keyHash = hashApiKey(apiKey)
  const db = createServerClient()
  if (!db) return null

  const { data, error } = await db
    .from('user_api_keys')
    .select('user_id, is_active')
    .eq('encrypted_key', keyHash)
    .eq('is_active', true)
    .single()

  if (error || !data) return null
  return data.user_id
}

function successResponse(data: unknown) {
  return NextResponse.json({ success: true, data, timestamp: Date.now() })
}

function errorResponse(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function rateLimitResponse(key: string) {
  const retryAfter = Math.ceil((getRateLimitResetAt(key) - Date.now()) / 1000)
  return NextResponse.json(
    { success: false, error: 'Rate limit exceeded' },
    { status: 429, headers: { 'Retry-After': String(retryAfter), 'X-RateLimit-Remaining': '0' } },
  )
}

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Params) {
  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey) return errorResponse('Missing X-API-Key header', 401)

  const userId = await verifyApiKey(apiKey)
  if (!userId) return errorResponse('Invalid API key', 401)

  if (!rateLimitCheck(userId)) return rateLimitResponse(userId)

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const days = Math.max(1, Math.min(365, parseInt(searchParams.get('days') || '30', 10) || 30))

  const db = createServerClient()
  if (!db) {
    return successResponse({
      avi: 0,
      delta: 0,
      components: {
        citationRate: 0,
        mentionRate: 0,
        sentimentScore: 0,
        recommendationRate: 0,
        positionAvg: 0,
      },
      history: [],
    })
  }

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data: brand } = await db
    .from('brands')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!brand) return errorResponse('Brand not found', 404)

  const { data: scores, error } = await db
    .from('brand_health_scores')
    .select(
      'date, avi_score, health_score, citation_rate, mention_rate, sentiment_score, recommendation_rate, position_avg',
    )
    .eq('brand_id', id)
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0])
    .order('date', { ascending: true })

  if (error) return errorResponse(error.message)

  const history = (scores || []).map((s) => ({
    date: s.date,
    avi: s.avi_score ?? s.health_score ?? 0,
    citationRate: s.citation_rate ?? 0,
    mentionRate: s.mention_rate ?? 0,
    sentimentScore: s.sentiment_score ?? 0,
    recommendationRate: s.recommendation_rate ?? 0,
    positionAvg: s.position_avg ?? 0,
  }))

  const latest = history[history.length - 1]
  const previous = history.length > 1 ? history[0] : null

  return successResponse({
    avi: latest?.avi ?? 0,
    delta: latest && previous ? Math.round((latest.avi - previous.avi) * 10) / 10 : 0,
    components: {
      citationRate: latest?.citationRate ?? 0,
      mentionRate: latest?.mentionRate ?? 0,
      sentimentScore: latest?.sentimentScore ?? 0,
      recommendationRate: latest?.recommendationRate ?? 0,
      positionAvg: latest?.positionAvg ?? 0,
    },
    history,
  })
}
