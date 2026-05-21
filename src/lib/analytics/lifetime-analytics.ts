import { createServerClient, getCurrentUserId } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export interface LifetimeAnalytics {
  brandId: string
  totalQueries: number
  totalBrandMentions: number
  totalCitations: number
  domainCitations: number
  visibilityScore: number
  topProvider: string | null
  averageMentionsPerQuery: number
  averageCitationsPerQuery: number
  firstQueryAt: string | null
  lastQueryAt: string | null
  providerDistribution: Record<string, number>
  sentimentBreakdown: Record<string, number>
  queryCategoryBreakdown: Record<string, number>
}

export async function getLifetimeAnalytics(brandId: string): Promise<LifetimeAnalytics | null> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) return null

    const supabase = createServerClient()
    if (!supabase) return getMockLifetimeAnalytics(brandId)

    const { data, error } = await supabase
      .from('monitoring_results')
      .select('*')
      .eq('brand_id', brandId)
      .eq('user_id', userId)

    if (error) throw error
    if (!data || data.length === 0) return null

    let totalBrandMentions = 0
    let totalCitations = 0
    const domainCitations = 0
    let topProvider: string | null = null
    let topProviderCount = 0
    const providerDistribution: Record<string, number> = {}
    const sentimentBreakdown: Record<string, number> = {}
    const queryCategoryBreakdown: Record<string, number> = {}
    let firstQueryAt: string | null = null
    let lastQueryAt: string | null = null

    for (const row of data) {
      totalBrandMentions += row.mention_count || 0

      const citedUrls = row.cited_urls || []
      totalCitations += citedUrls.length

      const provider = row.engine || 'unknown'
      providerDistribution[provider] = (providerDistribution[provider] || 0) + 1
      if ((providerDistribution[provider] || 0) > topProviderCount) {
        topProviderCount = providerDistribution[provider]
        topProvider = provider
      }

      const sentiment = row.sentiment || 'neutral'
      sentimentBreakdown[sentiment] = (sentimentBreakdown[sentiment] || 0) + 1

      const category = (row.mention_type as string) || 'unknown'
      queryCategoryBreakdown[category] = (queryCategoryBreakdown[category] || 0) + 1

      if (row.created_at && (!firstQueryAt || row.created_at < firstQueryAt)) {
        firstQueryAt = row.created_at
      }
      if (row.created_at && (!lastQueryAt || row.created_at > lastQueryAt)) {
        lastQueryAt = row.created_at
      }
    }

    const visibilityScore =
      data.length > 0
        ? Math.min(
            100,
            (totalBrandMentions / data.length) * 20 +
              (domainCitations / Math.max(1, totalCitations)) * 50,
          )
        : 0

    return {
      brandId,
      totalQueries: data.length,
      totalBrandMentions,
      totalCitations,
      domainCitations,
      visibilityScore,
      topProvider,
      averageMentionsPerQuery: data.length > 0 ? totalBrandMentions / data.length : 0,
      averageCitationsPerQuery: data.length > 0 ? totalCitations / data.length : 0,
      firstQueryAt,
      lastQueryAt,
      providerDistribution,
      sentimentBreakdown,
      queryCategoryBreakdown,
    }
  } catch (err) {
    logger.error('Failed to get lifetime analytics', { error: err })
    return null
  }
}

function getMockLifetimeAnalytics(brandId: string): LifetimeAnalytics {
  return {
    brandId,
    totalQueries: 150,
    totalBrandMentions: 89,
    totalCitations: 234,
    domainCitations: 156,
    visibilityScore: 72,
    topProvider: 'chatgpt',
    averageMentionsPerQuery: 0.59,
    averageCitationsPerQuery: 1.56,
    firstQueryAt: '2024-01-15T10:00:00Z',
    lastQueryAt: new Date().toISOString(),
    providerDistribution: {
      chatgpt: 45,
      gemini: 38,
      perplexity: 35,
      claude: 32,
    },
    sentimentBreakdown: {
      positive: 65,
      neutral: 55,
      negative: 30,
    },
    queryCategoryBreakdown: {
      awareness: 40,
      interest: 35,
      consideration: 30,
      purchase: 25,
      comparison: 20,
    },
  }
}
