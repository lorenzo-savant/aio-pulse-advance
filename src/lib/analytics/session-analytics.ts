import { createServerClient, getCurrentUserId } from '@/lib/supabase'
import { logger } from '@/lib/logger'

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
    // Without a configured DB there is no real session data. Returning
    // hardcoded mock figures used to pollute the UI; null is honest.
    if (!supabase) return null

    let query = supabase
      .from('monitoring_results')
      .select('*')
      .eq('brand_id', brandId)
      .eq('user_id', userId)

    // monitoring_results has no `session_id` column (it never did — the old
    // filter made every session query error out and return null). A session is
    // a single prompt execution, so filter on the real `prompt_id` instead.
    if (sessionId) {
      query = query.eq('prompt_id', sessionId)
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
    let latencySumMs = 0
    let latencyCount = 0

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

      if (row.execution_time_ms != null && row.execution_time_ms > 0) {
        latencySumMs += row.execution_time_ms
        latencyCount += 1
      }

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
      averageLatencyMs: latencyCount > 0 ? Math.round(latencySumMs / latencyCount) : 0,
      providersUsed: Array.from(uniqueProviders),
    }
  } catch (err) {
    logger.error('Failed to get session analytics', { error: err })
    return null
  }
}
