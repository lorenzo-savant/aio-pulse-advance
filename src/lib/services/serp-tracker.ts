import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { DataForSEOProvider, type DataForSEOResult } from '@/lib/providers/dataforseo-provider'

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

export async function dailyTrack(
  brandId: string,
  keywords: string[],
  brandUrl?: string,
): Promise<RankingResult[]> {
  const provider = new DataForSEOProvider()
  const results: RankingResult[] = []

  for (const keyword of keywords) {
    try {
      const response = await provider.execute({
        prompt: keyword,
        model: JSON.stringify({ depth: 20 }),
      })

      if (!response.success) {
        logger.warn('SERP query failed', {
          service: 'serp-tracker',
          keyword,
          error: response.error,
        })
        results.push({
          keyword,
          url: null,
          position: 0,
          aiOverviewPresent: false,
          organicResults: [],
          aiOverviews: [],
        })
        continue
      }

      const data = response as unknown as DataForSEOResult
      const brandDomain = brandUrl ? new URL(brandUrl).hostname : ''

      let position = 0
      let url: string | null = null

      for (const result of data.organicResults || []) {
        if (brandDomain && result.url.includes(brandDomain)) {
          position = result.rank
          url = result.url
          break
        }
      }

      const aiOverviewPresent = detectAiOverview(data.aiOverviews || [], brandDomain)

      results.push({
        keyword,
        url,
        position,
        aiOverviewPresent,
        organicResults: (data.organicResults || []).slice(0, 10).map((r) => ({
          title: r.title,
          url: r.url,
          rank: r.rank,
        })),
        aiOverviews: data.aiOverviews || [],
      })

      const db = createServerClient()
      if (db) {
        await db.from('keyword_rankings').insert({
          brand_id: brandId,
          keyword,
          url,
          position,
          ai_overview_present: aiOverviewPresent,
        })
      }
    } catch (error) {
      logger.error('SERP tracking error', { service: 'serp-tracker', keyword, error })
      results.push({
        keyword,
        url: null,
        position: 0,
        aiOverviewPresent: false,
        organicResults: [],
        aiOverviews: [],
      })
    }
  }

  return results
}

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
