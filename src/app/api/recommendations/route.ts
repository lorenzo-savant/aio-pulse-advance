// PATH: src/app/api/recommendations/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { callGemini } from '@/lib/services/gemini'
import { verifyBrandAccess } from '@/lib/authorize'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// ─── GET /api/recommendations?brand_id=xxx ─────────────────────────────────
// Load saved recommendation history for a brand
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
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10) || 10, 50)

  if (!brandId) return err('brand_id is required', 400)

  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { data, error: fetchErr } = await (db as any)
    .from('recommendation_history')
    .select('id, brand_id, recommendations, summary, based_on_count, created_at')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (fetchErr) return err(fetchErr.message)

  return NextResponse.json({
    success: true,
    data: data || [],
    timestamp: Date.now(),
  })
}

// ─── POST /api/recommendations ───────────────────────────────────────────────
// Generate personalized content recommendations based on monitoring data
export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  let body: { brand_id?: string }
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  if (!body.brand_id) return err('brand_id is required', 400)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // Fetch brand (use safe columns)
  const brand = await verifyBrandAccess(body.brand_id, userId)
  if (!brand) return err('Brand not found', 404)

  // Fetch latest monitoring results
  const { data: results } = await (db as any)
    .from('monitoring_results')
    .select(
      'engine, brand_mentioned, mention_position, visibility_score, sentiment, sentiment_score, competitor_mentions, prompt_text',
    )
    .eq('brand_id', body.brand_id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Fetch keyword data
  const { data: keywords } = await (db as any)
    .from('keyword_tracking')
    .select('keyword, frequency, mention_correlation')
    .eq('brand_id', body.brand_id)
    .order('frequency', { ascending: false })
    .limit(20)

  // Build context for AI
  const monitoringSummary = summarizeMonitoring(results || [], brand)
  const keywordSummary = (keywords || [])
    .map(
      (k: any) =>
        `"${k.keyword}" (freq: ${k.frequency}, correlation: ${(k.mention_correlation * 100).toFixed(0)}%)`,
    )
    .join(', ')

  const prompt = `You are an AIO (AI Optimization) consultant. Based on the monitoring data below, generate actionable content recommendations for the brand "${brand.name}" (${(brand as any).industry || 'general business'}).

MONITORING DATA:
${monitoringSummary}

TOP KEYWORDS: ${keywordSummary || 'No keyword data yet'}

COMPETITORS: ${brand.competitors?.join(', ') || 'None specified'}

Generate exactly 8 recommendations. Each should have:
1. A specific, actionable title
2. Priority (high/medium/low)
3. Expected impact on AI visibility (high/medium/low)
4. Which AI engines it targets most
5. A detailed description (2-3 sentences)
6. Category: one of "content_creation", "content_optimization", "technical_seo", "authority_building", "competitive_strategy"

Respond ONLY with valid JSON (no markdown):
{
  "recommendations": [
    {
      "title": "...",
      "priority": "high|medium|low",
      "impact": "high|medium|low",
      "engines": ["chatgpt", "gemini", "perplexity", "claude"],
      "description": "...",
      "category": "..."
    }
  ],
  "summary": "2-3 sentence overview of the brand's current AI visibility status and key areas for improvement"
}`

  try {
    const raw = await callGemini(prompt)
    const cleaned = raw
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    let parsed: any
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Try to extract JSON
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
      else throw new Error('Failed to parse recommendations')
    }

    // ── Save to database ───────────────────────────────────────────────────
    try {
      await (db as any).from('recommendation_history').insert({
        brand_id: body.brand_id,
        user_id: userId,
        recommendations: parsed.recommendations || [],
        summary: parsed.summary,
        based_on_count: (results?.length || 0) + (keywords?.length || 0),
      })
    } catch (dbError) {
      console.error('[/api/recommendations] Failed to save result:', dbError)
    }

    return NextResponse.json({
      success: true,
      data: parsed,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('[/api/recommendations] Error:', error)
    return err(error instanceof Error ? error.message : 'Failed to generate recommendations')
  }
}

function summarizeMonitoring(results: any[], brand: any): string {
  if (results.length === 0) return 'No monitoring data available yet.'

  const total = results.length
  const mentioned = results.filter((r) => r.brand_mentioned).length
  const citationRate = ((mentioned / total) * 100).toFixed(1)
  const avgVisibility = (
    results.reduce((s, r) => s + (r.visibility_score || 0), 0) / total
  ).toFixed(1)

  const sentiments = { positive: 0, neutral: 0, negative: 0 }
  results.forEach((r) => {
    if (r.sentiment) sentiments[r.sentiment as keyof typeof sentiments]++
  })

  const engineStats: Record<string, { total: number; mentioned: number }> = {}
  results.forEach((r) => {
    if (!engineStats[r.engine]) engineStats[r.engine] = { total: 0, mentioned: 0 }
    engineStats[r.engine]!.total++
    if (r.brand_mentioned) engineStats[r.engine]!.mentioned++
  })

  const engineSummary = Object.entries(engineStats)
    .map(
      ([engine, stats]) =>
        `${engine}: ${((stats.mentioned / stats.total) * 100).toFixed(0)}% citation rate`,
    )
    .join(', ')

  // Top competitors mentioned
  const compMentions: Record<string, number> = {}
  results.forEach((r) => {
    ;(r.competitor_mentions || []).forEach((c: any) => {
      compMentions[c.name] = (compMentions[c.name] || 0) + c.count
    })
  })

  const topComps = Object.entries(compMentions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `${name} (${count} mentions)`)
    .join(', ')

  return `Brand: ${brand.name}
Total scans: ${total}, Brand mentioned: ${mentioned} (${citationRate}%)
Average visibility: ${avgVisibility}/100
Sentiment: ${sentiments.positive} positive, ${sentiments.neutral} neutral, ${sentiments.negative} negative
Per-engine: ${engineSummary}
Top competitor mentions: ${topComps || 'None'}`
}