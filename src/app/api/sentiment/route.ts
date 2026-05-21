// PATH: src/app/api/sentiment/route.ts
import { formatValidationError } from '@/lib/format-validation-error'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { analyzeSentiment, detectHallucinations } from '@/lib/services/monitoring'
import { logger } from '@/lib/logger'

// ─── Validation ───────────────────────────────────────────────────────────────

const analyzeSchema = z.object({
  text: z.string().min(10).max(10_000),
  brand_id: z.string().uuid(),
  mode: z.enum(['sentiment', 'hallucination', 'both']).default('both'),
  known_facts: z.array(z.string().max(500)).max(20).optional().default([]),
})

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// ─── POST /api/sentiment ──────────────────────────────────────────────────────
// Runs sentiment analysis and/or hallucination detection on the provided text.
export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const parsed = analyzeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: formatValidationError(parsed.error),
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    )
  }

  const { text, brand_id, mode, known_facts } = parsed.data
  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // Verify brand belongs to this user
  const { data: brand } = await db
    .from('brands')
    .select('name')
    .eq('id', brand_id)
    .eq('user_id', userId)
    .single()

  if (!brand) return err('Brand not found or access denied', 404)

  const brandName = brand.name

  const result: Record<string, unknown> = {}

  // Run analyses in parallel where possible
  const tasks: Promise<void>[] = []

  if (mode !== 'hallucination') {
    tasks.push(
      analyzeSentiment(text, brandName).then((s) => {
        result['sentiment'] = s
      }),
    )
  }

  if (mode !== 'sentiment') {
    tasks.push(
      detectHallucinations(text, brandName, known_facts).then((h) => {
        result['hallucination'] = h
      }),
    )
  }

  try {
    await Promise.all(tasks)
  } catch (analysisErr) {
    logger.error('Analysis error', { source: 'sentiment', error: String(analysisErr) })
    const message = analysisErr instanceof Error ? analysisErr.message : 'Analysis failed'
    return err(message)
  }

  return NextResponse.json({ success: true, data: result, timestamp: Date.now() })
}

// ─── GET /api/sentiment ───────────────────────────────────────────────────────
// Returns aggregated sentiment stats for a brand.
// ?brand_id=uuid  → required
export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')

  if (!brandId) return err('brand_id query parameter is required', 400)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { data, error } = await db
    .from('monitoring_results')
    .select('sentiment, sentiment_score, engine, has_hallucination, created_at, brand_mentioned')
    .eq('brand_id', brandId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return err(error.message)

  const results: any[] = data ?? []
  const mentioned = results.filter((r: any) => r.brand_mentioned)

  // Aggregate sentiment counts and average score
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 }
  let totalScore = 0

  for (const r of mentioned) {
    if (r.sentiment) {
      sentimentCounts[r.sentiment as keyof typeof sentimentCounts] =
        (sentimentCounts[r.sentiment as keyof typeof sentimentCounts] ?? 0) + 1
    }
    if (r.sentiment_score != null) totalScore += r.sentiment_score
  }

  const avgSentimentScore = mentioned.length > 0 ? totalScore / mentioned.length : 0

  const hallucinationCount = results.filter((r: any) => r.has_hallucination).length
  const hallucinationRate = results.length > 0 ? hallucinationCount / results.length : 0

  // Average sentiment score per engine
  const byEngine: Record<string, { avg: number; count: number }> = {}
  for (const r of mentioned) {
    if (!byEngine[r.engine]) byEngine[r.engine] = { avg: 0, count: 0 }
    byEngine[r.engine]!.avg += r.sentiment_score ?? 0
    byEngine[r.engine]!.count++
  }
  for (const eng of Object.keys(byEngine)) {
    const e = byEngine[eng]!
    e.avg = e.count > 0 ? e.avg / e.count : 0
  }

  // ── Trend: average sentiment score per day (ascending) ────────────────────
  const dayMap = new Map<string, { sum: number; count: number }>()
  for (const r of mentioned) {
    const day = String(r.created_at).slice(0, 10)
    if (!day) continue
    const e = dayMap.get(day) ?? { sum: 0, count: 0 }
    e.sum += r.sentiment_score ?? 0
    e.count++
    dayMap.set(day, e)
  }
  const timeline = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { sum, count }]) => ({
      date,
      avgScore: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
      count,
    }))

  // ── Aspect-based sentiment breakdown ("what drives sentiment") ────────────
  // Defensive: the sentiment_aspects column may not exist yet (migration not
  // applied). A failed query is swallowed so the endpoint keeps working.
  let aspectBreakdown: Array<{
    aspect: string
    positive: number
    negative: number
    neutral: number
    total: number
    net: number
  }> = []
  try {
    const { data: aspectRows, error: aspectErr } = await db
      .from('monitoring_results')
      .select('sentiment_aspects')
      .eq('brand_id', brandId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (!aspectErr && Array.isArray(aspectRows)) {
      const tally = new Map<string, { positive: number; negative: number; neutral: number }>()
      for (const row of aspectRows as Array<{ sentiment_aspects?: unknown }>) {
        const aspects = Array.isArray(row.sentiment_aspects) ? row.sentiment_aspects : []
        for (const a of aspects) {
          if (!a || typeof a !== 'object') continue
          const name = (a as { aspect?: unknown }).aspect
          const s = (a as { sentiment?: unknown }).sentiment
          if (typeof name !== 'string') continue
          if (s !== 'positive' && s !== 'negative' && s !== 'neutral') continue
          const e = tally.get(name) ?? { positive: 0, negative: 0, neutral: 0 }
          e[s]++
          tally.set(name, e)
        }
      }
      aspectBreakdown = [...tally.entries()]
        .map(([aspect, c]) => {
          const total = c.positive + c.negative + c.neutral
          return {
            aspect,
            ...c,
            total,
            net: total > 0 ? Math.round(((c.positive - c.negative) / total) * 100) / 100 : 0,
          }
        })
        .sort((a, b) => b.total - a.total)
    }
  } catch {
    // sentiment_aspects column not present yet — skip the breakdown.
  }

  return NextResponse.json({
    success: true,
    data: {
      sentimentCounts,
      avgSentimentScore,
      hallucinationCount,
      hallucinationRate,
      byEngine,
      timeline,
      aspectBreakdown,
      totalResults: results.length,
      mentionedResults: mentioned.length,
    },
    timestamp: Date.now(),
  })
}
