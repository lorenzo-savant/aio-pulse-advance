// PATH: src/app/api/sentiment/by-source/route.ts
//
// GET /api/sentiment/by-source?brand_id=…&engine=…&days=30
//
// "Where is the AI getting its impressions from?"
//
// For every domain the AI engines cite in a brand's monitoring responses,
// compute the SENTIMENT of those responses. Lets the operator see which
// cited sources drive negative sentiment — and act on them (correct the
// source content, reach out, etc.). Closes the Semrush "look at sentiment
// sources/triggers" best practice (#5 of 6 — the only one we didn't
// already cover).
//
// Pure aggregation over data we already collect (monitoring_results.
// cited_urls + .sentiment_score). No new API, no new dependency.

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface ResultRow {
  cited_urls: string[] | null
  sentiment_score: number | null
  sentiment: 'positive' | 'negative' | 'neutral' | null
  engine: string | null
  created_at: string
  id: string
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

function normalizeBrandDomain(domain: string | null): string | null {
  if (!domain) return null
  return (
    hostOf(domain) ??
    domain
      .toLowerCase()
      .replace(/^www\./, '')
      .split('/')[0] ??
    null
  )
}

/** Bucket a -1..+1 sentiment into a 3-way label using the same thresholds
 *  the rest of the app uses (>= 0.2 positive, <= -0.2 negative, else neutral). */
function skewOf(avg: number): 'positive' | 'negative' | 'neutral' {
  if (avg >= 0.2) return 'positive'
  if (avg <= -0.2) return 'negative'
  return 'neutral'
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

  const ownedDomain = normalizeBrandDomain(brand.domain)
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
      .select('id, cited_urls, sentiment_score, sentiment, engine, created_at')
      .eq('brand_id', brandId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(5000)
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (engine !== 'all') query = query.eq('engine', engine)

    const { data, error } = await query
    if (error) {
      logger.error('/api/sentiment/by-source query failed', { err: error })
      return err('Failed to load sentiment-by-source data')
    }

    const rows = (data || []) as ResultRow[]
    const isOwned = (host: string): boolean =>
      !!ownedDomain && (host === ownedDomain || host.endsWith(`.${ownedDomain}`))

    interface Agg {
      domain: string
      owned: boolean
      mentions: number
      sentimentSum: number
      sentimentCount: number // responses with a non-null sentiment_score
      pos: number
      neg: number
      neu: number
      engines: Set<string>
      sampleResponseIds: Set<string>
      lastSeen: string
    }
    const byDomain = new Map<string, Agg>()
    let totalAnalyzed = 0

    for (const row of rows) {
      const urls = Array.isArray(row.cited_urls) ? row.cited_urls : []
      if (urls.length === 0) continue
      totalAnalyzed++

      // Dedupe URLs within a single response so one response counts once per
      // domain (not once per page on that domain).
      const hosts = new Set<string>()
      for (const rawUrl of urls) {
        const h = hostOf(rawUrl)
        if (h) hosts.add(h)
      }

      for (const host of hosts) {
        let agg = byDomain.get(host)
        if (!agg) {
          agg = {
            domain: host,
            owned: isOwned(host),
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
          byDomain.set(host, agg)
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

    const sources = [...byDomain.values()]
      .filter((d) => d.mentions >= minMentions)
      .map((d) => {
        const avg = d.sentimentCount > 0 ? d.sentimentSum / d.sentimentCount : 0
        return {
          domain: d.domain,
          owned: d.owned,
          mentions: d.mentions,
          avgSentiment: Math.round(avg * 1000) / 1000,
          skew: skewOf(avg),
          pos: d.pos,
          neg: d.neg,
          neu: d.neu,
          engines: [...d.engines].sort(),
          sampleResponseIds: [...d.sampleResponseIds],
          lastSeen: d.lastSeen,
        }
      })

    // Most actionable first: domains correlated with NEGATIVE sentiment, then
    // by mention volume (so an obscure 1-off doesn't outrank a recurring driver).
    sources.sort((a, b) => a.avgSentiment - b.avgSentiment || b.mentions - a.mentions)

    const topNegative = sources.filter((s) => s.skew === 'negative').slice(0, 25)
    const topPositive = [...sources]
      .sort((a, b) => b.avgSentiment - a.avgSentiment || b.mentions - a.mentions)
      .filter((s) => s.skew === 'positive')
      .slice(0, 25)

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalAnalyzed,
          uniqueSources: byDomain.size,
          negativeSources: sources.filter((s) => s.skew === 'negative').length,
          positiveSources: sources.filter((s) => s.skew === 'positive').length,
          neutralSources: sources.filter((s) => s.skew === 'neutral').length,
          minMentions,
          ownedDomain,
        },
        // Full ranked list (negative first), capped at 50 for payload size.
        sources: sources.slice(0, 50),
        topNegative,
        topPositive,
        filters: { engine, days, minMentions },
      },
      timestamp: Date.now(),
    })
  } catch (e) {
    logger.error('/api/sentiment/by-source failed', { err: e })
    return err('Failed to aggregate sentiment by source')
  }
}
