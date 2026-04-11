// PATH: src/app/api/sentiment/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { analyzeSentiment, detectHallucinations } from '@/lib/services/monitoring'

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
        message: 'Validation failed',
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
    console.error('[/api/sentiment] Analysis error:', analysisErr)
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

  return NextResponse.json({
    success: true,
    data: {
      sentimentCounts,
      avgSentimentScore,
      hallucinationCount,
      hallucinationRate,
      byEngine,
      totalResults: results.length,
      mentionedResults: mentioned.length,
    },
    timestamp: Date.now(),
  })
}
