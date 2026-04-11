import { createServerClient, getCurrentUserId } from '@/lib/supabase'

export interface SessionAnalytics {
  sessionId: string
  brandId: string
  providerBreakdown: Record<
    string,
    {
      mentions: number
      citations: number
      queries: number
    }
  >
  totalBrandMentions: number
  totalCitations: number
  totalQueries: number
  lastQueryAt: string | null
  averageLatencyMs: number
  providersUsed: string[]
}

export async function getSessionAnalytics(
  brandId: string,
  sessionId?: string,
): Promise<SessionAnalytics | null> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) return null

    const supabase = createServerClient()
    if (!supabase) return getMockSessionAnalytics(brandId)

    let query = supabase
      .from('monitoring_results')
      .select('*')
      .eq('brand_id', brandId)
      .eq('user_id', userId)

    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    if (!data || data.length === 0) return null

    const providerBreakdown: Record<
      string,
      { mentions: number; citations: number; queries: number }
    > = {}
    let totalBrandMentions = 0
    let totalCitations = 0
    const uniqueProviders = new Set<string>()
    let lastQueryAt: string | null = null

    for (const row of data) {
      const provider = row.engine || 'unknown'
      if (!providerBreakdown[provider]) {
        providerBreakdown[provider] = { mentions: 0, citations: 0, queries: 0 }
      }

      providerBreakdown[provider].mentions += row.mention_count || 0
      providerBreakdown[provider].citations += row.cited_urls?.length || 0
      providerBreakdown[provider].queries += 1

      totalBrandMentions += row.mention_count || 0
      totalCitations += row.cited_urls?.length || 0
      uniqueProviders.add(provider)

      if (row.created_at && (!lastQueryAt || row.created_at > lastQueryAt)) {
        lastQueryAt = row.created_at
      }
    }

    return {
      sessionId: sessionId || 'current',
      brandId,
      providerBreakdown,
      totalBrandMentions,
      totalCitations,
      totalQueries: data.length,
      lastQueryAt,
      averageLatencyMs: 0,
      providersUsed: Array.from(uniqueProviders),
    }
  } catch (err) {
    console.error('Failed to get session analytics:', err)
    return null
  }
}

function getMockSessionAnalytics(brandId: string): SessionAnalytics {
  return {
    sessionId: 'mock-session',
    brandId,
    providerBreakdown: {
      chatgpt: { mentions: 5, citations: 12, queries: 3 },
      gemini: { mentions: 3, citations: 8, queries: 3 },
    },
    totalBrandMentions: 8,
    totalCitations: 20,
    totalQueries: 6,
    lastQueryAt: new Date().toISOString(),
    averageLatencyMs: 1500,
    providersUsed: ['chatgpt', 'gemini'],
  }
}
