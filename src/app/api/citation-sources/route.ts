// PATH: src/app/api/citation-sources/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { classifyCitation, type CitationType } from '@/lib/utils/citation-classifier'
import {
  classifyCitationDepth,
  type CitationDepth,
  type DepthBreakdown,
  emptyDepthBreakdown,
  deepPageRate,
} from '@/lib/utils/citation-depth'
import {
  classifyDomainAuthority,
  computeAiTrustScore,
  type DomainCategory,
} from '@/lib/utils/ai-trust-score'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface ResultRow {
  cited_urls: string[] | null
  engine: string | null
  created_at: string
  brand_mentioned: boolean | null
  sentiment_score: number | null
}

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

/** Lowercase registrable host, no protocol / www / path. */
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

// ─── GET /api/citation-sources — which domains AI engines cite ───────────────
// Query params: brand_id (required), engine (default all), days (default 30)
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

  const ownedDomain = normalizeBrandDomain(brand.domain)
  const since = new Date()
  since.setDate(since.getDate() - days)

  try {
    let query = (
      db as unknown as ReturnType<typeof createServerClient> & {
        from: (t: string) => any
      }
    )
      .from('monitoring_results')
      .select('cited_urls, engine, created_at, brand_mentioned, sentiment_score')
      .eq('brand_id', brandId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(5000)

    if (engine !== 'all') query = query.eq('engine', engine)

    const { data, error } = await query

    if (error) {
      logger.error('/api/citation-sources query failed', { err: error })
      return err('Failed to load citation data')
    }

    const rows = (data || []) as ResultRow[]

    const isOwned = (host: string): boolean =>
      !!ownedDomain && (host === ownedDomain || host.endsWith(`.${ownedDomain}`))

    interface TypeBreakdown {
      informational: number
      product: number
      multimedia: number
    }
    const emptyBreakdown = (): TypeBreakdown => ({ informational: 0, product: 0, multimedia: 0 })
    const dominantOf = (b: TypeBreakdown): CitationType => {
      // Highest count wins; ties resolved by the deterministic order
      // informational > product > multimedia (mirrors the heuristic precedence).
      const entries: Array<[CitationType, number]> = [
        ['informational', b.informational],
        ['product', b.product],
        ['multimedia', b.multimedia],
      ]
      entries.sort((a, b) => b[1] - a[1])
      return entries[0]![0]
    }

    interface Agg {
      domain: string
      count: number
      owned: boolean
      engines: Set<string>
      sampleUrls: Set<string>
      types: TypeBreakdown
      depths: DepthBreakdown
      sentimentSum: number
      sentimentCount: number
      lastSeen: string
    }
    /** Page-level aggregation for URLs on the brand's OWN domain. */
    interface PageAgg {
      url: string
      count: number
      engines: Set<string>
      lastSeen: string
    }
    const domains = new Map<string, Agg>()
    const ownedPagesMap = new Map<string, PageAgg>()
    const byEngine = new Map<string, number>()
    const byDay = new Map<string, number>()
    const citationTypeBreakdown: TypeBreakdown = emptyBreakdown()
    const citationDepthBreakdown: DepthBreakdown = emptyDepthBreakdown()

    let totalResponses = 0
    let responsesWithSources = 0
    let totalCitations = 0
    let ownedCitations = 0

    for (const row of rows) {
      totalResponses++
      const urls = Array.isArray(row.cited_urls) ? row.cited_urls : []
      if (urls.length > 0) responsesWithSources++

      const eng = row.engine || 'unknown'
      const day = row.created_at.slice(0, 10)

      for (const rawUrl of urls) {
        const host = hostOf(rawUrl)
        if (!host) continue

        totalCitations++
        const owned = isOwned(host)
        if (owned) ownedCitations++

        const citationType = classifyCitation(rawUrl)
        citationTypeBreakdown[citationType]++
        const citationDepth: CitationDepth = classifyCitationDepth(rawUrl)
        citationDepthBreakdown[citationDepth]++

        byEngine.set(eng, (byEngine.get(eng) || 0) + 1)
        byDay.set(day, (byDay.get(day) || 0) + 1)

        let agg = domains.get(host)
        if (!agg) {
          agg = {
            domain: host,
            count: 0,
            owned,
            engines: new Set(),
            sampleUrls: new Set(),
            types: emptyBreakdown(),
            depths: emptyDepthBreakdown(),
            sentimentSum: 0,
            sentimentCount: 0,
            lastSeen: row.created_at,
          }
          domains.set(host, agg)
        }
        agg.count++
        agg.engines.add(eng)
        agg.types[citationType]++
        agg.depths[citationDepth]++
        if (typeof row.sentiment_score === 'number') {
          agg.sentimentSum += row.sentiment_score
          agg.sentimentCount++
        }
        if (agg.sampleUrls.size < 3) agg.sampleUrls.add(rawUrl)
        if (row.created_at > agg.lastSeen) agg.lastSeen = row.created_at

        // Page-level aggregation for owned URLs: normalize the path so the
        // same page with different query strings / fragments collapses.
        if (owned) {
          let normalizedUrl: string
          try {
            const u = new URL(rawUrl)
            // Strip query + fragment; keep trailing slash off for stable keys.
            const path = u.pathname.replace(/\/+$/, '') || '/'
            normalizedUrl = `${u.protocol}//${u.host}${path}`
          } catch {
            normalizedUrl = rawUrl
          }
          let pageAgg = ownedPagesMap.get(normalizedUrl)
          if (!pageAgg) {
            pageAgg = {
              url: normalizedUrl,
              count: 0,
              engines: new Set(),
              lastSeen: row.created_at,
            }
            ownedPagesMap.set(normalizedUrl, pageAgg)
          }
          pageAgg.count++
          pageAgg.engines.add(eng)
          if (row.created_at > pageAgg.lastSeen) pageAgg.lastSeen = row.created_at
        }
      }
    }

    const topDomains = [...domains.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 50)
      .map((d) => {
        const avgSentiment = d.sentimentCount > 0 ? d.sentimentSum / d.sentimentCount : null
        const category: DomainCategory = classifyDomainAuthority(d.domain)
        const trust = computeAiTrustScore({
          host: d.domain,
          category,
          citationsCount: d.count,
          totalCitationsInWindow: totalCitations,
          engines: [...d.engines],
          avgSentiment,
        })
        return {
          domain: d.domain,
          count: d.count,
          share: totalCitations > 0 ? Math.round((d.count / totalCitations) * 1000) / 10 : 0,
          owned: d.owned,
          engines: [...d.engines].sort(),
          sampleUrls: [...d.sampleUrls],
          dominantType: dominantOf(d.types),
          typeBreakdown: d.types,
          // Page-depth mix for this domain (root / hub / leaf). Used by the
          // UI to surface "AI cites your blog/docs, not your homepage" per
          // the Semrush AEO finding that AI favours deep subpages.
          depthBreakdown: d.depths,
          deepPageRate: deepPageRate(d.depths),
          // AI Trust Score: proprietary 0–100 metric (cross-engine + domain
          // category + volume share + sentiment alignment). Free signals only.
          trustScore: trust.score,
          trustCategory: trust.category,
          trustReasoning: trust.reasoning,
          avgSentiment: avgSentiment !== null ? Math.round(avgSentiment * 1000) / 1000 : null,
          lastSeen: d.lastSeen,
        }
      })

    const ownedPages = [...ownedPagesMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 50)
      .map((p) => ({
        url: p.url,
        count: p.count,
        share: ownedCitations > 0 ? Math.round((p.count / ownedCitations) * 1000) / 10 : 0,
        engines: [...p.engines].sort(),
        lastSeen: p.lastSeen,
      }))

    const timeline = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))

    const engineBreakdown = [...byEngine.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([engine, count]) => ({ engine, count }))

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalResponses,
          responsesWithSources,
          sourcedRate:
            totalResponses > 0
              ? Math.round((responsesWithSources / totalResponses) * 1000) / 10
              : 0,
          totalCitations,
          uniqueDomains: domains.size,
          ownedCitations,
          externalCitations: totalCitations - ownedCitations,
          ownedShare:
            totalCitations > 0 ? Math.round((ownedCitations / totalCitations) * 1000) / 10 : 0,
          ownedDomain,
          // Citation-type mix across all sources for the period.
          citationTypeBreakdown,
          // Citation-depth mix (root / hub / leaf) + deep-page rate %.
          // Aligns with the Semrush AEO finding that AI engines favour
          // deep subpages over homepage URLs even when ranking the latter.
          citationDepthBreakdown,
          deepPageRate: deepPageRate(citationDepthBreakdown),
        },
        domains: topDomains,
        /**
         * Top URLs on the brand's own domain that AI engines cited, with the
         * full path preserved (query/fragment stripped). Empty if the brand
         * has no configured domain or no owned citations in the window.
         */
        ownedPages,
        engineBreakdown,
        timeline,
        filters: { engine, days },
      },
      timestamp: Date.now(),
    })
  } catch (e) {
    logger.error('/api/citation-sources failed', { err: e })
    return err('Failed to aggregate citation sources')
  }
}
