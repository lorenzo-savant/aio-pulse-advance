// PATH: src/app/api/competitor/sentiment/route.ts
//
// GET /api/competitor/sentiment?brand_id=…&engine=…&days=30
//
// "How does the AI describe each competitor vs how it describes us?"
//
// For every competitor named in a brand's monitoring responses, aggregate
// the SENTIMENT of those responses + pos/neg/neu breakdown + engines + the
// brand's own sentiment baseline for direct comparison. Pure aggregation
// over data we already collect — no new API, no new dependency.

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface ResultRow {
  id: string
  brand_mentioned: boolean | null
  competitor_mentions: Array<{ name?: string | null }> | null
  sentiment_score: number | null
  sentiment: 'positive' | 'negative' | 'neutral' | null
  engine: string | null
  created_at: string
}

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

/** Same -0.2 / +0.2 thresholds the rest of the app uses. */
function skewOf(avg: number): 'positive' | 'negative' | 'neutral' {
  if (avg >= 0.2) return 'positive'
  if (avg <= -0.2) return 'negative'
  return 'neutral'
}

function normalizeName(raw: string): string {
  return raw.trim().toLowerCase()
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
  const minMentions = Math.max(1, Number(searchParams.get('min_mentions')) || 2)

  if (!brandId) return err('brand_id is required', 400)

  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  const since = new Date()
  since.setDate(since.getDate() - days)

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let query = (
      db as unknown as ReturnType<typeof createServerClient> & {
        from: (t: string) => any
      }
    )
      .from('monitoring_results')
      .select(
        'id, brand_mentioned, competitor_mentions, sentiment_score, sentiment, engine, created_at',
      )
      .eq('brand_id', brandId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(5000)
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (engine !== 'all') query = query.eq('engine', engine)

    const { data, error } = await query
    if (error) {
      logger.error('/api/competitor/sentiment query failed', { err: error })
      return err('Failed to load competitor-sentiment data')
    }

    const rows = (data || []) as ResultRow[]

    interface Agg {
      name: string // display name (first-seen casing)
      mentions: number
      sentimentSum: number
      sentimentCount: number
      pos: number
      neg: number
      neu: number
      engines: Set<string>
      sampleResponseIds: Set<string>
      lastSeen: string
    }
    const byCompetitor = new Map<string, Agg>()

    // Own-brand baseline so the UI can put each competitor in context.
    let brandSentimentSum = 0
    let brandSentimentCount = 0
    let brandPos = 0
    let brandNeg = 0
    let brandNeu = 0
    let totalAnalyzed = 0

    for (const row of rows) {
      totalAnalyzed++

      // Own-brand baseline: count responses where the brand was actually
      // mentioned + the response carried a sentiment_score.
      if (row.brand_mentioned && typeof row.sentiment_score === 'number') {
        brandSentimentSum += row.sentiment_score
        brandSentimentCount++
        if (row.sentiment === 'positive') brandPos++
        else if (row.sentiment === 'negative') brandNeg++
        else if (row.sentiment === 'neutral') brandNeu++
      }

      const mentions = Array.isArray(row.competitor_mentions) ? row.competitor_mentions : []
      if (mentions.length === 0) continue

      // Dedupe competitor names within a single response so one response
      // counts once per competitor.
      const seen = new Set<string>()
      for (const m of mentions) {
        const raw = m?.name
        if (!raw || typeof raw !== 'string') continue
        const key = normalizeName(raw)
        if (!key || seen.has(key)) continue
        seen.add(key)

        let agg = byCompetitor.get(key)
        if (!agg) {
          agg = {
            name: raw.trim(),
            mentions: 0,
            sentimentSum: 0,
            sentimentCount: 0,
            pos: 0,
            neg: 0,
            neu: 0,
            engines: new Set(),
            sampleResponseIds: new Set(),
            lastSeen: row.created_at,
          }
          byCompetitor.set(key, agg)
        }
        agg.mentions++
        if (typeof row.sentiment_score === 'number') {
          agg.sentimentSum += row.sentiment_score
          agg.sentimentCount++
        }
        if (row.sentiment === 'positive') agg.pos++
        else if (row.sentiment === 'negative') agg.neg++
        else if (row.sentiment === 'neutral') agg.neu++
        if (row.engine) agg.engines.add(row.engine)
        if (agg.sampleResponseIds.size < 3) agg.sampleResponseIds.add(row.id)
        if (row.created_at > agg.lastSeen) agg.lastSeen = row.created_at
      }
    }

    const ownAvg = brandSentimentCount > 0 ? brandSentimentSum / brandSentimentCount : 0
    const ownSkew = brandSentimentCount > 0 ? skewOf(ownAvg) : 'neutral'

    const competitors = [...byCompetitor.values()]
      .filter((c) => c.mentions >= minMentions)
      .map((c) => {
        const avg = c.sentimentCount > 0 ? c.sentimentSum / c.sentimentCount : 0
        return {
          name: c.name,
          mentions: c.mentions,
          avgSentiment: Math.round(avg * 1000) / 1000,
          skew: skewOf(avg),
          // How much better/worse the AI describes this competitor vs you.
          // Positive number = competitor is described MORE favorably than you.
          deltaVsBrand: brandSentimentCount > 0 ? Math.round((avg - ownAvg) * 1000) / 1000 : null,
          pos: c.pos,
          neg: c.neg,
          neu: c.neu,
          engines: [...c.engines].sort(),
          sampleResponseIds: [...c.sampleResponseIds],
          lastSeen: c.lastSeen,
        }
      })

    // Default sort: by mention volume so high-frequency competitors lead.
    // Caller can re-sort client-side (e.g. by deltaVsBrand ascending to see
    // who is beating you on AI portrayal).
    competitors.sort((a, b) => b.mentions - a.mentions || a.avgSentiment - b.avgSentiment)

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalAnalyzed,
          uniqueCompetitors: byCompetitor.size,
          rankedCompetitors: competitors.length,
          minMentions,
          ownBrand: {
            name: brand.name,
            mentions: brandSentimentCount,
            avgSentiment: brandSentimentCount > 0 ? Math.round(ownAvg * 1000) / 1000 : 0,
            skew: ownSkew,
            pos: brandPos,
            neg: brandNeg,
            neu: brandNeu,
          },
        },
        competitors: competitors.slice(0, 50),
        filters: { engine, days, minMentions },
      },
      timestamp: Date.now(),
    })
  } catch (e) {
    logger.error('/api/competitor/sentiment failed', { err: e })
    return err('Failed to aggregate competitor sentiment')
  }
}
