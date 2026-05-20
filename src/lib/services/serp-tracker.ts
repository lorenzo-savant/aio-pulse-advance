// PATH: src/lib/services/serp-tracker.ts
//
// Citation tracking + AI Overview detection — split per the v2 API strategy.
//
// Before: single dailyTrack() call made ONE DataForSEO query returning Google
// organic position + AI Overview block. DFS was the only provider.
//
// After (v2 strategy):
//   - Rank tracking on Brave's index → "AI citation tracking"
//     (free 2k/mo, no Google rank data anymore — the v2 marketing repositioning
//     explicitly accepts this trade-off)
//   - AI Overview detection on DataForSEO → narrow-scope correct use of DFS
//   - dailyTrack() composes both in parallel; the persisted
//     keyword_rankings row stays the same shape so getTrends() / dashboards
//     don't need to change.

import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { DataForSEOProvider, type DataForSEOResult } from '@/lib/providers/dataforseo-provider'
import { searchBrandRanking, isBraveSearchAvailable } from './brave-search'

export interface RankingResult {
  keyword: string
  url: string | null
  position: number
  aiOverviewPresent: boolean
  organicResults: Array<{ title: string; url: string; rank: number }>
  aiOverviews: DataForSEOResult['aiOverviews']
}

export interface TrendData {
  keyword: string
  positions: Array<{ date: string; position: number; aiOverviewPresent: boolean }>
  avgPosition: number
  aiOverviewDays: number
}

/**
 * Does the brand domain appear in any AI Overview's citation links?
 * Pure helper, unchanged from the original implementation. Lives here
 * (and not in dataforseo-provider.ts) because the rule is product-level,
 * not provider-level.
 */
export function detectAiOverview(
  aiOverviews: DataForSEOResult['aiOverviews'],
  brandDomain: string,
): boolean {
  if (!brandDomain || !aiOverviews || aiOverviews.length === 0) {
    return false
  }

  for (const overview of aiOverviews) {
    for (const link of overview.links || []) {
      if (link.url && link.url.includes(brandDomain)) {
        return true
      }
    }
  }

  return false
}

// ─── Citation tracking (Brave index) ─────────────────────────────────────────

interface BraveRankPerKeyword {
  keyword: string
  position: number
  url: string | null
  organicResults: Array<{ title: string; url: string; rank: number }>
}

/**
 * Find the brand's position in Brave's organic results for each keyword.
 * Returns one row per keyword; `position: 0` and `url: null` mean the brand
 * wasn't in the top 20 results. Uses the Brave free 2k/mo quota.
 */
async function trackBraveRankings(
  keywords: string[],
  brandDomain: string,
  language?: string,
): Promise<BraveRankPerKeyword[]> {
  if (!isBraveSearchAvailable()) {
    logger.warn('Brave not configured — skipping rank tracking', { service: 'serp-tracker' })
    return keywords.map((k) => ({ keyword: k, position: 0, url: null, organicResults: [] }))
  }

  const results: BraveRankPerKeyword[] = []
  for (const keyword of keywords) {
    try {
      const r = await searchBrandRanking(keyword, brandDomain, language)
      results.push({
        keyword,
        position: r.position,
        url: r.url,
        organicResults: r.organicResults.map((o) => ({ title: o.title, url: o.url, rank: o.rank })),
      })
    } catch (err) {
      logger.warn('Brave rank lookup failed', {
        service: 'serp-tracker',
        keyword,
        error: String(err),
      })
      results.push({ keyword, position: 0, url: null, organicResults: [] })
    }
  }
  return results
}

// ─── AI Overview detection (DataForSEO — narrow scope) ───────────────────────

interface AiOverviewPerKeyword {
  keyword: string
  present: boolean
  /** Raw DFS aiOverviews data (kept for downstream UI / debugging). */
  aiOverviews: DataForSEOResult['aiOverviews']
}

/**
 * Check whether Google shows an AI Overview for each keyword, and whether
 * the brand domain is cited within. DataForSEO is the only provider with
 * structured access to this — Brave's Summarizer is a DIFFERENT surface
 * (Brave's own AI answer, not Google's AI Overview), so it would be
 * intellectually dishonest to substitute one for the other.
 */
async function checkAiOverviews(
  keywords: string[],
  brandDomain: string,
): Promise<AiOverviewPerKeyword[]> {
  const provider = new DataForSEOProvider()
  if (!provider.isConfigured()) {
    logger.warn('DataForSEO not configured — skipping AI Overview detection', {
      service: 'serp-tracker',
    })
    return keywords.map((k) => ({ keyword: k, present: false, aiOverviews: [] }))
  }

  const results: AiOverviewPerKeyword[] = []
  for (const keyword of keywords) {
    try {
      const response = await provider.execute({
        prompt: keyword,
        model: JSON.stringify({ depth: 20 }),
      })
      if (!response.success) {
        logger.warn('DFS AI Overview query failed', {
          service: 'serp-tracker',
          keyword,
          error: response.error,
        })
        results.push({ keyword, present: false, aiOverviews: [] })
        continue
      }
      const data = response as unknown as DataForSEOResult
      const aiOverviews = data.aiOverviews || []
      results.push({
        keyword,
        present: detectAiOverview(aiOverviews, brandDomain),
        aiOverviews,
      })
    } catch (err) {
      logger.error('DFS AI Overview lookup error', {
        service: 'serp-tracker',
        keyword,
        error: err,
      })
      results.push({ keyword, present: false, aiOverviews: [] })
    }
  }
  return results
}

// ─── Composer ────────────────────────────────────────────────────────────────

export async function dailyTrack(
  brandId: string,
  keywords: string[],
  brandUrl?: string,
): Promise<RankingResult[]> {
  const brandDomain = brandUrl ? new URL(brandUrl).hostname : ''
  const language = process.env.AIO_LANGUAGE_CODE || undefined

  // Run both in parallel — independent providers, independent quotas.
  // If either is unconfigured the helper logs a warning and returns empty;
  // the composer still produces a row per keyword.
  const [braveRanks, aiOverviews] = await Promise.all([
    trackBraveRankings(keywords, brandDomain, language),
    checkAiOverviews(keywords, brandDomain),
  ])

  const aoByKeyword = new Map(aiOverviews.map((a) => [a.keyword, a]))

  const results: RankingResult[] = []
  const db = createServerClient()

  for (const b of braveRanks) {
    const ao = aoByKeyword.get(b.keyword) ?? { present: false, aiOverviews: [] }
    results.push({
      keyword: b.keyword,
      url: b.url,
      position: b.position,
      aiOverviewPresent: ao.present,
      organicResults: b.organicResults,
      aiOverviews: ao.aiOverviews,
    })

    if (db) {
      try {
        await db.from('keyword_rankings').insert({
          brand_id: brandId,
          keyword: b.keyword,
          url: b.url,
          position: b.position,
          ai_overview_present: ao.present,
        })
      } catch (err) {
        logger.warn('keyword_rankings insert failed', {
          service: 'serp-tracker',
          keyword: b.keyword,
          error: String(err),
        })
      }
    }
  }

  return results
}

// ─── Trend reader (unchanged — agnostic of which provider supplied the row) ──

export async function getTrends(brandId: string, days: number = 30): Promise<TrendData[]> {
  const db = createServerClient()
  if (!db) return []

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data: rankings, error } = await db
    .from('keyword_rankings')
    .select('keyword, position, ai_overview_present, created_at')
    .eq('brand_id', brandId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true })

  if (error || !rankings) {
    logger.error('Trend fetch error', { service: 'serp-tracker', error })
    return []
  }

  const groupedByKeyword: Record<
    string,
    Array<{ date: string; position: number; aiOverviewPresent: boolean }>
  > = {}

  for (const r of rankings) {
    const keyword = r.keyword
    if (!groupedByKeyword[keyword]) {
      groupedByKeyword[keyword] = []
    }
    const date = r.created_at?.split('T')[0] ?? ''
    const position = r.position ?? 0
    const aiOverviewPresent = r.ai_overview_present ?? false
    const arr = groupedByKeyword[keyword]
    arr.push({
      date,
      position,
      aiOverviewPresent,
    })
  }

  const trends: TrendData[] = Object.entries(groupedByKeyword).map(([keyword, positions]) => {
    const validPositions = positions.filter((p) => p.position > 0)
    const avgPosition =
      validPositions.length > 0
        ? validPositions.reduce((sum, p) => sum + p.position, 0) / validPositions.length
        : 0

    const aiOverviewDays = positions.filter((p) => p.aiOverviewPresent).length

    return {
      keyword,
      positions,
      avgPosition: Math.round(avgPosition * 100) / 100,
      aiOverviewDays,
    }
  })

  return trends.sort((a, b) => a.keyword.localeCompare(b.keyword))
}
