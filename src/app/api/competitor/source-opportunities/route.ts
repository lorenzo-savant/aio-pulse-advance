// PATH: src/app/api/competitor/source-opportunities/route.ts
//
// GET /api/competitor/source-opportunities?brand_id=…&days=30
//
// "Where am I losing to competitors?"
//
// Surfaces monitoring responses where COMPETITORS got mentioned and you did
// NOT — i.e. queries the AI is answering by recommending other brands
// instead of you. Each row is an actionable opportunity: a specific prompt,
// on a specific engine, where you can move the needle by improving the
// content / building citations on the sources the AI is using.
//
// Pure aggregation over monitoring_results.brand_mentioned +
// .competitor_mentions[]. No new API, no new dependency.

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface ResultRow {
  id: string
  prompt_text: string | null
  engine: string | null
  brand_mentioned: boolean | null
  competitor_mentions: Array<{ name?: string | null }> | null
  cited_urls: string[] | null
  sentiment: 'positive' | 'negative' | 'neutral' | null
  sentiment_score: number | null
  created_at: string
}

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

function hostOf(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`)
    return u.hostname.toLowerCase().replace(/^www\./, '') || null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const engine = searchParams.get('engine') || 'all'
  const days = Math.min(365, Math.max(1, Number(searchParams.get('days')) || 30))

  if (!brandId) return err('brand_id is required', 400)

  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  const since = new Date()
  since.setDate(since.getDate() - days)

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let query = (db as any)
      .from('monitoring_results')
      .select(
        'id, prompt_text, engine, brand_mentioned, competitor_mentions, cited_urls, sentiment, sentiment_score, created_at',
      )
      .eq('brand_id', brandId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(5000)
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (engine !== 'all') query = query.eq('engine', engine)

    const { data, error } = await query
    if (error) {
      logger.error('/api/competitor/source-opportunities query failed', { err: error })
      return err('Failed to load source-opportunities data')
    }

    const rows = (data || []) as ResultRow[]

    // An "opportunity" = a response where the brand was NOT mentioned but at
    // least one competitor was. That's the AI answering a brand-relevant
    // query by recommending someone else.
    const opportunities: Array<{
      id: string
      promptText: string
      engine: string
      competitors: string[]
      citedDomains: string[]
      sentiment: string | null
      sentimentScore: number | null
      createdAt: string
    }> = []

    const byCompetitor = new Map<string, { name: string; count: number }>()
    const byEngine = new Map<string, number>()
    const byPrompt = new Map<
      string,
      { promptText: string; count: number; competitors: Set<string> }
    >()
    let totalResponses = 0

    for (const row of rows) {
      totalResponses++
      const isOpportunity = row.brand_mentioned === false && Array.isArray(row.competitor_mentions)
      if (!isOpportunity) continue

      const mentions = (row.competitor_mentions ?? []).filter(
        (m): m is { name: string } => typeof m?.name === 'string' && m.name.trim().length > 0,
      )
      if (mentions.length === 0) continue

      // Dedupe competitor names within a single response.
      const competitorsInRow = [...new Set(mentions.map((m) => m.name.trim()))]
      const eng = row.engine || 'unknown'
      const promptText = (row.prompt_text || '').trim() || '(empty prompt)'

      // Domains the AI cited as it justified the answer — useful breadcrumbs
      // for the user to know WHERE to act (which third-party site to target).
      const citedDomains = [
        ...new Set(
          (row.cited_urls ?? []).map((u) => hostOf(u)).filter((h): h is string => h !== null),
        ),
      ].slice(0, 5)

      opportunities.push({
        id: row.id,
        promptText,
        engine: eng,
        competitors: competitorsInRow,
        citedDomains,
        sentiment: row.sentiment,
        sentimentScore: row.sentiment_score,
        createdAt: row.created_at,
      })

      // Aggregate by competitor name (lowercased key, first-seen casing kept).
      for (const cname of competitorsInRow) {
        const key = cname.toLowerCase()
        const agg = byCompetitor.get(key) ?? { name: cname, count: 0 }
        agg.count++
        byCompetitor.set(key, agg)
      }

      // Aggregate by engine.
      byEngine.set(eng, (byEngine.get(eng) || 0) + 1)

      // Aggregate by prompt text (group recurring "lost prompts" together).
      const pkey = promptText.toLowerCase()
      const pagg = byPrompt.get(pkey) ?? {
        promptText,
        count: 0,
        competitors: new Set<string>(),
      }
      pagg.count++
      for (const c of competitorsInRow) pagg.competitors.add(c)
      byPrompt.set(pkey, pagg)
    }

    const totalOpportunities = opportunities.length
    const opportunityRate =
      totalResponses > 0 ? Math.round((totalOpportunities / totalResponses) * 1000) / 10 : 0

    const competitorRanking = [...byCompetitor.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
    const engineBreakdown = [...byEngine.entries()]
      .map(([eng, count]) => ({ engine: eng, count }))
      .sort((a, b) => b.count - a.count)
    const promptRanking = [...byPrompt.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 25)
      .map((p) => ({ promptText: p.promptText, count: p.count, competitors: [...p.competitors] }))

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalResponses,
          totalOpportunities,
          opportunityRate,
          uniqueCompetitorsTaking: byCompetitor.size,
          uniquePromptsLost: byPrompt.size,
          windowDays: days,
        },
        // Sort the raw opportunity list most-recent-first (default scan order
        // for the operator). The UI can re-sort by frequency client-side.
        opportunities: opportunities.slice(0, 100),
        topCompetitors: competitorRanking,
        topLostPrompts: promptRanking,
        engineBreakdown,
        filters: { engine, days },
      },
      timestamp: Date.now(),
    })
  } catch (e) {
    logger.error('/api/competitor/source-opportunities failed', { err: e })
    return err('Failed to aggregate source opportunities')
  }
}
