// PATH: src/app/api/geo-score/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { calculateGeoScore, gradeFor, type GeoScoreInput } from '@/lib/services/geo-score'
import { loadLatestSiteAuditSummary } from '@/lib/services/site-audit-summary'
import { sampleConfidence } from '@/lib/services/confidence'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface HealthRow {
  date: string
  citation_rate?: number | null
  mention_rate?: number | null
  visibility_score?: number | null
  recommendation_rate?: number | null
  sentiment_score?: number | null
  position_avg?: number | null
  hallucination_rate?: number | null
  engine_breakdown?: unknown
}

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

function toInput(row: HealthRow): GeoScoreInput {
  return {
    citationRate: row.citation_rate ?? 0,
    mentionRate: row.mention_rate ?? row.visibility_score ?? 0,
    recommendationRate: row.recommendation_rate ?? 0,
    sentimentScore: row.sentiment_score ?? 0,
    positionAvg: row.position_avg ?? 0,
    hallucinationRate: row.hallucination_rate ?? 0,
  }
}

/** `engine_breakdown` is stored JSON.stringify'd into a Json column. */
function parseEngineBreakdown(raw: unknown): Record<string, number> {
  let obj: unknown = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return {}
    }
  }
  if (!obj || typeof obj !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const n = Number(v)
    if (Number.isFinite(n)) out[k] = n
  }
  return out
}

// ─── GET /api/geo-score — GEO (Generative Engine Optimization) scorecard ─────
// Query params: brand_id (required), period (7d|30d|60d|90d, default 30d)
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const period = searchParams.get('period') || '30d'

  if (!brandId) return err('brand_id is required', 400)
  if (!(await verifyBrandAccess(brandId, userId))) {
    return err('Brand not found or access denied', 404)
  }

  const daysBack = period === '7d' ? 7 : period === '60d' ? 60 : period === '90d' ? 90 : 30
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysBack)

  try {
    // Health-score history + cached site audit summary run in parallel —
    // the audit query is a single small read so it doesn't add latency.
    const healthQuery = (
      db as unknown as ReturnType<typeof createServerClient> & {
        from: (t: string) => any
      }
    )
      .from('brand_health_scores')
      .select(
        'date, citation_rate, mention_rate, visibility_score, recommendation_rate, sentiment_score, position_avg, hallucination_rate, engine_breakdown',
      )
      .eq('brand_id', brandId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(200)

    // Sample size = how many real monitoring responses back this score in the
    // window. Drives a confidence label so a score from 6 scans isn't shown as
    // certain (AI-Visibility-Readiness "confidence scales with sample size").
    const countQuery = (
      db as unknown as ReturnType<typeof createServerClient> & { from: (t: string) => any }
    )
      .from('monitoring_results')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .gte('created_at', startDate.toISOString())

    const [{ data, error }, siteAudit, { count: sampleCount }] = await Promise.all([
      healthQuery,
      loadLatestSiteAuditSummary(brandId),
      countQuery,
    ])
    const sampleSize = sampleCount ?? 0
    const confidence = sampleConfidence(sampleSize)

    if (error) {
      logger.error('/api/geo-score query failed', { err: error })
      return err('Failed to load GEO score data')
    }

    const rows = (data || []) as HealthRow[]

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          score: 0,
          grade: gradeFor(0),
          delta: 0,
          previousScore: 0,
          pillars: [],
          recommendations: [],
          history: [],
          engineBreakdown: [],
          date: null,
          hasData: false,
          siteAudit,
          sampleSize,
          confidence,
        },
        timestamp: Date.now(),
      })
    }

    // rows are date-desc; [0] is the latest
    const latest = rows[0]!
    const result = calculateGeoScore(toInput(latest))

    // Previous period = oldest row in window (or the one ~period/2 back).
    const previousRow = rows[rows.length - 1]!
    const previousScore =
      rows.length > 1 ? calculateGeoScore(toInput(previousRow)).score : result.score
    const delta = Math.round((result.score - previousScore) * 10) / 10

    // Trend series, oldest → newest, for the line chart.
    const history = [...rows]
      .reverse()
      .map((r) => ({ date: r.date, score: calculateGeoScore(toInput(r)).score }))

    const engineBreakdown = Object.entries(parseEngineBreakdown(latest.engine_breakdown))
      .map(([engine, visibility]) => ({ engine, visibility: Math.round(visibility * 10) / 10 }))
      .sort((a, b) => b.visibility - a.visibility)

    return NextResponse.json({
      success: true,
      data: {
        score: result.score,
        grade: result.grade,
        delta,
        previousScore,
        pillars: result.pillars,
        recommendations: result.recommendations,
        history,
        engineBreakdown,
        date: latest.date,
        hasData: true,
        siteAudit,
        sampleSize,
        confidence,
      },
      timestamp: Date.now(),
    })
  } catch (e) {
    logger.error('/api/geo-score failed', { err: e })
    return err('Failed to compute GEO score')
  }
}
