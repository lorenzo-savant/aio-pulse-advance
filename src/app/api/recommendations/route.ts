// PATH: src/app/api/recommendations/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { callLLM } from '@/lib/services/prompt-generator-ai'
import { verifyBrandAccess } from '@/lib/authorize'
import { rateLimitGate } from '@/lib/api-auth'
import { logger } from '@/lib/logger'
import { buildGlossaryContext } from '@/lib/data/glossary'
import {
  buildModelBehaviorContext,
  buildInterpretabilityGapContext,
  buildSemanticMonopolyContext,
} from '@/lib/data/research'

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

  const { data, error: fetchErr } = await db
    .from('recommendation_history')
    .select('id, brand_id, recommendations, summary, based_on_count, created_at')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (fetchErr) {
    logger.error('/api/recommendations failed', { err: fetchErr })
    return err('Failed to load data')
  }

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

  // Expensive Gemini-backed endpoint — throttle per user.
  const limited = await rateLimitGate(req, `recommendations:${userId}`, 10)
  if (limited) return limited

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
  const { data: results } = await db
    .from('monitoring_results')
    .select(
      'engine, brand_mentioned, mention_position, visibility_score, sentiment, sentiment_score, competitor_mentions, response_text, prompt_text',
    )
    .eq('brand_id', body.brand_id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Fetch keyword data
  const { data: keywords } = await db
    .from('keyword_tracking')
    .select('keyword, mention_count, correlation_score')
    .eq('brand_id', body.brand_id)
    .order('mention_count', { ascending: false })
    .limit(20)

  // Build context for AI
  const monitoringSummary = summarizeMonitoring(results || [], brand)
  const keywSummary = (keywords || [])
    .filter((k: any) => k.keyword)
    .slice(0, 15)
    .map(
      (k: any) =>
        `"${k.keyword}" (${k.mention_count || 0} occurrences, correlation: ${((k.correlation_score || 0) * 100).toFixed(0)}%)`,
    )
    .join(', ')

  const responseExcerpts = extractResponseExcerpts(results || [])
  const desc = (brand as { description?: string | null }).description
  const glossaryContext = buildGlossaryContext()
  const modelBehaviorContext = buildModelBehaviorContext()
  const gapContext = buildInterpretabilityGapContext()
  const monopolyContext = buildSemanticMonopolyContext(
    (brand as { industry?: string | null }).industry || undefined,
  )
  const prompt = `You are an AIO (AI Optimization) consultant specializing in GEO (Generative Engine Optimization). Below is real monitoring data for "${brand.name}". Based SPECIFICALLY on the actual responses from AI engines and the metrics below, identify concrete weaknesses and generate targeted recommendations.

${glossaryContext}

${modelBehaviorContext}

${monopolyContext}

${gapContext}

BRAND: ${brand.name}
INDUSTRY: ${(brand as { industry?: string | null }).industry || 'general business'}
DESCRIPTION: ${desc || 'Not specified'}
DOMAIN: ${(brand as { domain?: string | null }).domain || 'Not specified'}
TARGET MARKET: ${(brand as { language?: string }).language === 'sv' ? 'Sweden (Swedish-language)' : (brand as { language?: string }).language === 'it' ? 'Italy (Italian-language)' : 'International (English)'}

MONITORING DATA:
${monitoringSummary}

TOP KEYWORDS: ${keywSummary || 'No keyword data yet'}

COMPETITORS: ${brand.competitors?.join(', ') || 'None specified'}

PER-ENGINE WEAKNESSES:
${buildEngineWeaknesses(results || [])}

ACTUAL AI RESPONSE EXCERPTS (verbatim from monitoring):
${responseExcerpts}

INSTRUCTIONS:
Analyze the monitoring data and response excerpts above. Identify specific weaknesses or gaps. Then generate exactly 8 recommendations that DIRECTLY address the problems found in the data.

For each recommendation:
1. Title: specific, references concrete content or issue (NOT generic like "impro X")
2. Priority: high/medium/low — based on severity of the weakness
3. Impact: high/medium/low — expected effect on AI visibility
4. Engines: choose from the engines that have the specific weakness
5. Description: 2-3 sentences, MUST reference the actual monitoring data or response excerpt that justifies this recommendation
6. Category: pick the best single category that fits

IMPORTANT: Recommendations MUST be different from each other and tied to specific data points above. Do NOT generate generic SEO advice.

Respond ONLY with valid JSON (no markdown):
{
  "recommendations": [
    {
      "title": "...",
      "priority": "high|medium|low",
      "impact": "high|medium|low",
      "engines": ["chatgpt", "gemini", "perplexity", "claude"],
      "description": "...",
      "category": "content_creation|content_optimization|technical_seo|authority_building|competitive_strategy"
    }
  ],
  "summary": "2-3 sentence overview that references the specific data points driving these recommendations"
}`

  try {
    // Resilient JSON-mode chain (Groq → Cerebras → Mistral → Gemini → OpenAI):
    // a single provider's rate-limit / timeout / truncation falls back to the
    // next instead of failing the whole request (the cause of the previous
    // "Failed to generate recommendations" on a single bare-Gemini call).
    const systemPrompt =
      'You are an AIO/GEO content consultant. Respond with ONLY a single valid JSON object matching the schema in the user message — no markdown, no code fences, no prose.'
    const { text: raw } = await callLLM(systemPrompt, prompt)

    // Strip fences, then slice the outermost {...} so any stray prose around the
    // object never breaks parsing.
    const stripped = raw
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    const start = stripped.indexOf('{')
    const end = stripped.lastIndexOf('}')
    const candidate = start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped

    let parsed: any
    try {
      parsed = JSON.parse(candidate)
    } catch {
      throw new Error('Failed to parse recommendations')
    }

    // ── Save to database ───────────────────────────────────────────────────
    try {
      await db.from('recommendation_history').insert({
        brand_id: body.brand_id,
        user_id: userId,
        recommendations: parsed.recommendations || [],
        summary: parsed.summary,
        based_on_count: (results?.length || 0) + (keywords?.length || 0),
      })
    } catch (dbError) {
      logger.error('Failed to save recommendation result', {
        route: '/api/recommendations',
        error: dbError,
      })
    }

    return NextResponse.json({
      success: true,
      data: parsed,
      timestamp: Date.now(),
    })
  } catch (error) {
    logger.error('Error generating recommendations', { route: '/api/recommendations', error })
    return err('Failed to generate recommendations')
  }
}

function extractResponseExcerpts(results: any[]): string {
  if (results.length === 0) return 'No monitoring data available.'

  const byEngine = new Map<string, string[]>()
  for (const r of results) {
    if (!byEngine.has(r.engine)) byEngine.set(r.engine, [])
    const arr = byEngine.get(r.engine)!
    const text = r.response_text || ''
    if (text.length > 80) {
      const snippet = text
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 400)
      arr.push(snippet)
    }
  }

  const lines: string[] = []
  for (const [engine, texts] of byEngine) {
    if (texts.length > 0) {
      lines.push(`--- ${engine} actual response excerpt ---`)
      texts.slice(0, 1).forEach((t) => lines.push(`"${t}..."`))
    }
  }
  return lines.length > 0 ? lines.join('\n') : 'No response text available.'
}

function buildEngineWeaknesses(results: any[]): string {
  if (results.length === 0) return 'No monitoring data yet.'

  const byEngine = new Map<string, { scores: number[]; sentiments: string[] }>()
  for (const r of results) {
    if (!byEngine.has(r.engine)) byEngine.set(r.engine, { scores: [], sentiments: [] })
    const s = byEngine.get(r.engine)!
    if (r.visibility_score != null) s.scores.push(r.visibility_score)
    if (r.sentiment) s.sentiments.push(r.sentiment)
  }

  const lines: string[] = []
  for (const [engine, data] of byEngine) {
    const avgScore =
      data.scores.length > 0
        ? (data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(0)
        : 'N/A'
    const negCount = data.sentiments.filter((s) => s === 'negative').length
    const weak = parseInt(avgScore) < 60
    lines.push(
      `${engine}: avg visibility ${avgScore}/100${weak ? ' ⚠️ (below 60 — needs improvement)' : ''}` +
        (negCount > 0 ? `, ${negCount} negative sentiment(s)` : ''),
    )
  }
  return lines.length > 0 ? lines.join('\n') : 'No engine data available.'
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
