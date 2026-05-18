import type {
  CostAnalytics as CostAnalyticsType,
  ProviderCostBreakdown,
  AgentCostBreakdown,
  DailyCost,
  HourlyPeak,
} from './types'

interface CostLogRow {
  id: string
  user_id: string
  brand_id: string | null
  provider: string
  model: string | null
  agent_type: string | null
  conversation_id: string | null
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cost_usd: number
  cost_credits: number
  latency_ms: number | null
  endpoint: string | null
  success: boolean
  error_message: string | null
  cached: boolean
  budget_alert: boolean
  created_at: string
}

export class CostAnalyticsService {
  async getAnalytics(
    userId: string,
    options?: {
      brandId?: string | null
      days?: number
      provider?: string
    },
  ): Promise<CostAnalyticsType> {
    const days = options?.days || 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const brandId = options?.brandId
    const provider = options?.provider

    const url = new URL('/rest/v1/ai_cost_logs', process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    url.searchParams.set('user_id', 'eq.' + userId)
    url.searchParams.set('created_at', 'gte.' + startDate.toISOString())
    if (brandId !== undefined && brandId) {
      url.searchParams.set('brand_id', 'eq.' + brandId)
    }
    if (provider) {
      url.searchParams.set('provider', 'eq.' + provider)
    }
    url.searchParams.set('select', '*')
    url.searchParams.set('order', 'created_at.desc')

    try {
      const response = await fetch(url.toString(), {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          Authorization:
            'Bearer ' +
            (process.env.SUPABASE_SERVICE_ROLE_KEY ||
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
              ''),
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
      })

      if (!response.ok) {
        return this.getEmptyAnalytics()
      }

      const logs = (await response.json()) as CostLogRow[]
      return this.computeAnalytics(logs)
    } catch {
      return this.getEmptyAnalytics()
    }
  }

  private computeAnalytics(logs: CostLogRow[]): CostAnalyticsType {
    if (!logs || logs.length === 0) {
      return this.getEmptyAnalytics()
    }

    const totalCost = logs.reduce((sum, log) => sum + (log.cost_usd || 0), 0)
    const totalTokens = logs.reduce((sum, log) => sum + (log.total_tokens || 0), 0)
    const totalRequests = logs.length
    const avgCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0
    const avgTokensPerRequest = totalRequests > 0 ? totalTokens / totalRequests : 0
    const avgLatencyMs =
      totalRequests > 0
        ? logs.reduce((sum, log) => sum + (log.latency_ms || 0), 0) / totalRequests
        : 0

    const providerBreakdown = this.getProviderBreakdown(logs)
    const agentBreakdown = this.getAgentBreakdown(logs)
    const dailyTrend = this.getDailyTrend(logs)
    const hourlyPeak = this.getHourlyPeak(logs)

    const successCount = logs.filter((log) => log.success).length
    const successRate = totalRequests > 0 ? successCount / totalRequests : 0

    const cacheCount = logs.filter((log) => log.cached).length
    const cacheHitRate = totalRequests > 0 ? cacheCount / totalRequests : 0

    return {
      totalCost,
      totalTokens,
      totalRequests,
      avgCostPerRequest,
      avgTokensPerRequest,
      avgLatencyMs,
      providerBreakdown,
      agentBreakdown,
      dailyTrend,
      hourlyPeak,
      successRate,
      cacheHitRate,
    }
  }

  private getProviderBreakdown(logs: CostLogRow[]): Record<string, ProviderCostBreakdown> {
    const providerMap = new Map<string, CostLogRow[]>()

    for (const log of logs) {
      if (!providerMap.has(log.provider)) {
        providerMap.set(log.provider, [])
      }
      providerMap.get(log.provider)!.push(log)
    }

    const result: Record<string, ProviderCostBreakdown> = {}
    for (const [provider, providerLogs] of providerMap) {
      const totalCost = providerLogs.reduce((sum, log) => sum + (log.cost_usd || 0), 0)
      const totalTokens = providerLogs.reduce((sum, log) => sum + (log.total_tokens || 0), 0)
      const requestCount = providerLogs.length
      const avgCostPerRequest = requestCount > 0 ? totalCost / requestCount : 0
      const avgLatencyMs =
        requestCount > 0
          ? providerLogs.reduce((sum, log) => sum + (log.latency_ms || 0), 0) / requestCount
          : 0
      const successCount = providerLogs.filter((log) => log.success).length
      const successRate = requestCount > 0 ? successCount / requestCount : 0

      result[provider] = {
        provider,
        totalCost,
        totalTokens,
        requestCount,
        avgCostPerRequest,
        avgLatencyMs,
        successRate,
      }
    }

    return result
  }

  private getAgentBreakdown(logs: CostLogRow[]): Record<string, AgentCostBreakdown> {
    const agentMap = new Map<string, CostLogRow[]>()

    for (const log of logs) {
      const agentType = log.agent_type || 'unknown'
      if (!agentMap.has(agentType)) {
        agentMap.set(agentType, [])
      }
      agentMap.get(agentType)!.push(log)
    }

    const result: Record<string, AgentCostBreakdown> = {}
    for (const [agentType, agentLogs] of agentMap) {
      const totalCost = agentLogs.reduce((sum, log) => sum + (log.cost_usd || 0), 0)
      const totalTokens = agentLogs.reduce((sum, log) => sum + (log.total_tokens || 0), 0)
      const requestCount = agentLogs.length
      const avgCostPerRequest = requestCount > 0 ? totalCost / requestCount : 0

      result[agentType] = {
        agentType,
        totalCost,
        totalTokens,
        requestCount,
        avgCostPerRequest,
      }
    }

    return result
  }

  private getDailyTrend(logs: CostLogRow[]): DailyCost[] {
    const dailyMap = new Map<string, { cost: number; tokens: number; requests: number }>()

    for (const log of logs) {
      const createdAt = log.created_at
      if (!createdAt) continue
      const dateParts = new Date(createdAt).toISOString().split('T')
      const date = dateParts[0]
      if (!date) continue
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { cost: 0, tokens: 0, requests: 0 })
      }
      const day = dailyMap.get(date)
      if (day) {
        day.cost += log.cost_usd || 0
        day.tokens += log.total_tokens || 0
        day.requests++
      }
    }

    return Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        cost: stats.cost,
        tokens: stats.tokens,
        requests: stats.requests,
      }))
  }

  private getHourlyPeak(logs: CostLogRow[]): HourlyPeak[] {
    const hourlyData: Record<number, { totalCost: number; count: number }> = {}
    for (let i = 0; i < 24; i++) {
      hourlyData[i] = { totalCost: 0, count: 0 }
    }

    for (const log of logs) {
      const createdAt = log.created_at
      if (!createdAt) continue
      const hour = new Date(createdAt).getHours()
      const entry = hourlyData[hour]
      if (entry) {
        entry.totalCost += log.cost_usd || 0
        entry.count++
      }
    }

    return Object.entries(hourlyData).map(([hour, data]) => ({
      hour: parseInt(hour),
      avgCost: data.count > 0 ? data.totalCost / data.count : 0,
      requestCount: data.count,
    }))
  }

  private getEmptyAnalytics(): CostAnalyticsType {
    return {
      totalCost: 0,
      totalTokens: 0,
      totalRequests: 0,
      avgCostPerRequest: 0,
      avgTokensPerRequest: 0,
      avgLatencyMs: 0,
      providerBreakdown: {},
      agentBreakdown: {},
      dailyTrend: [],
      hourlyPeak: [],
      successRate: 0,
      cacheHitRate: 0,
    }
  }
}

let globalCostAnalytics: CostAnalyticsService | null = null

export function getCostAnalytics(): CostAnalyticsService {
  if (!globalCostAnalytics) {
    globalCostAnalytics = new CostAnalyticsService()
  }
  return globalCostAnalytics
}
