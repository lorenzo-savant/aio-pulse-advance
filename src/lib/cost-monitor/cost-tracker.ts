import { createServerClient } from '@/lib/supabase'
import type { AIProviderId } from '@/lib/providers/types'
import {
  PROVIDER_PRICING,
  PROVIDER_DEFAULT_MODELS,
  type CostLogEntry,
  type CostEstimate,
  type BudgetAlert,
} from './types'
import { BudgetManager } from './budget-manager'

export interface CostLogInput {
  userId: string
  brandId?: string
  provider: AIProviderId | string
  model?: string
  agentType?: string
  conversationId?: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  costCredits: number
  latencyMs?: number
  endpoint?: string
  success: boolean
  errorMessage?: string
  cached?: boolean
}

export class CostTracker {
  private budgetManager: BudgetManager

  constructor() {
    this.budgetManager = new BudgetManager()
  }

  async logCost(input: CostLogInput): Promise<CostLogEntry | null> {
    const supabase = createServerClient()
    if (!supabase) return null

    const sb = supabase as any
    const totalTokens = input.inputTokens + input.outputTokens
    const model = input.model || PROVIDER_DEFAULT_MODELS[input.provider] || 'default'

    const { data, error } = await sb
      .from('ai_cost_logs')
      .insert({
        user_id: input.userId,
        brand_id: input.brandId || null,
        provider: input.provider,
        model,
        agent_type: input.agentType || null,
        conversation_id: input.conversationId || null,
        input_tokens: input.inputTokens,
        output_tokens: input.outputTokens,
        total_tokens: totalTokens,
        cost_usd: input.costUsd,
        cost_credits: input.costCredits,
        latency_ms: input.latencyMs || null,
        endpoint: input.endpoint || null,
        success: input.success,
        error_message: input.errorMessage || null,
        cached: input.cached || false,
        budget_alert: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to log cost:', error)
      return null
    }

    // Check budget alerts
    const alerts = await this.budgetManager.checkBudget(
      input.userId,
      input.brandId || null,
      input.costUsd,
      input.provider,
    )

    if (alerts.length > 0) {
      await sb.from('ai_cost_logs').update({ budget_alert: true }).eq('id', data.id)
    }

    return data as CostLogEntry
  }

  async estimateCost(
    provider: AIProviderId | string,
    inputTokens: number,
    outputTokens: number,
    model?: string,
  ): Promise<CostEstimate> {
    const modelName = model || PROVIDER_DEFAULT_MODELS[provider] || 'default'
    const pricing = PROVIDER_PRICING[modelName] || PROVIDER_PRICING.default

    const inputCost = (inputTokens / 1_000_000) * (pricing?.input || 0)
    const outputCost = (outputTokens / 1_000_000) * (pricing?.output || 0)
    const totalCost = inputCost + outputCost

    return {
      provider,
      model: modelName,
      inputTokens,
      outputTokens,
      estimatedCostUsd: parseFloat(totalCost.toFixed(6)),
    }
  }

  async getUserCosts(
    userId: string,
    options?: {
      brandId?: string | null
      startDate?: Date
      endDate?: Date
      provider?: string
      limit?: number
    },
  ): Promise<CostLogEntry[]> {
    const supabase = createServerClient()
    if (!supabase) return []

    const sb = supabase as any
    let query = sb
      .from('ai_cost_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (options?.brandId !== undefined) {
      query = query.eq('brand_id', options.brandId)
    }

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate.toISOString())
    }

    if (options?.endDate) {
      query = query.lte('created_at', options.endDate.toISOString())
    }

    if (options?.provider) {
      query = query.eq('provider', options.provider)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to get user costs:', error)
      return []
    }

    return (data || []) as CostLogEntry[]
  }

  async getProviderCosts(
    userId: string,
    days: number = 30,
  ): Promise<Record<string, { totalCost: number; totalTokens: number; requestCount: number }>> {
    const supabase = createServerClient()
    if (!supabase) return {}

    const sb = supabase as any
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await sb
      .from('ai_cost_logs')
      .select('provider, cost_usd, total_tokens')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())

    if (error) {
      console.error('Failed to get provider costs:', error)
      return {}
    }

    const result: Record<string, { totalCost: number; totalTokens: number; requestCount: number }> =
      {}
    for (const log of data || []) {
      if (!result[log.provider]) {
        result[log.provider] = { totalCost: 0, totalTokens: 0, requestCount: 0 }
      }
      const entry = result[log.provider]
      if (entry) {
        entry.totalCost += log.cost_usd || 0
        entry.totalTokens += log.total_tokens || 0
        entry.requestCount++
      }
    }

    return result
  }

  async getDailyCosts(
    userId: string,
    days: number = 30,
    brandId?: string | null,
  ): Promise<Array<{ date: string; cost: number; tokens: number; requests: number }>> {
    const supabase = createServerClient()
    if (!supabase) return []

    const sb = supabase as any
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    let query = sb
      .from('ai_cost_logs')
      .select('created_at, cost_usd, total_tokens')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })

    if (brandId) {
      query = query.eq('brand_id', brandId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to get daily costs:', error)
      return []
    }

    // Group by date
    const dailyMap = new Map<string, { cost: number; tokens: number; requests: number }>()
    for (const log of data || []) {
      const dateParts = new Date(log.created_at).toISOString().split('T')
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

    return Array.from(dailyMap.entries()).map(([date, stats]) => ({
      date,
      cost: stats.cost,
      tokens: stats.tokens,
      requests: stats.requests,
    }))
  }

  async getBudgetAlerts(userId: string, brandId?: string | null): Promise<BudgetAlert[]> {
    return this.budgetManager.checkBudget(userId, brandId || null, 0, '')
  }
}

let globalCostTracker: CostTracker | null = null

export function getCostTracker(): CostTracker {
  if (!globalCostTracker) {
    globalCostTracker = new CostTracker()
  }
  return globalCostTracker
}
