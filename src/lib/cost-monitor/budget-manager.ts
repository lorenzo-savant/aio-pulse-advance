import { createServerClient } from '@/lib/supabase'
import type { BudgetConfig, BudgetAlert } from './types'

export class BudgetManager {
  async getBudget(userId: string, brandId: string | null = null): Promise<BudgetConfig | null> {
    const supabase = createServerClient()
    if (!supabase) return null

    const sb = supabase as any
    let query = sb.from('ai_budgets').select('*').eq('user_id', userId)

    if (brandId) {
      query = query.eq('brand_id', brandId)
    } else {
      query = query.is('brand_id', null)
    }

    const { data, error } = await query.single()

    if (error || !data) {
      return this.createDefaultBudget(userId, brandId)
    }

    return data as BudgetConfig
  }

  async createDefaultBudget(userId: string, brandId: string | null = null): Promise<BudgetConfig> {
    const supabase = createServerClient()
    if (!supabase) {
      throw new Error('Supabase client not configured')
    }

    const sb = supabase as any
    const { data, error } = await sb
      .from('ai_budgets')
      .upsert(
        {
          user_id: userId,
          brand_id: brandId,
          monthly_limit_usd: 100,
          daily_limit_usd: 10,
          alert_threshold: 0.8,
          provider_limits: {},
          current_month_spend: 0,
          current_day_spend: 0,
        },
        {
          onConflict: 'user_id,brand_id',
        },
      )
      .select()
      .single()

    if (error) {
      console.error('Failed to create default budget:', error)
      throw error
    }

    return data as BudgetConfig
  }

  async updateBudget(
    userId: string,
    brandId: string | null,
    data: {
      monthlyLimitUsd?: number
      dailyLimitUsd?: number | null
      alertThreshold?: number
      providerLimits?: Record<string, number>
    },
  ): Promise<BudgetConfig | null> {
    const supabase = createServerClient()
    if (!supabase) return null

    const sb = supabase as any
    let query = sb
      .from('ai_budgets')
      .update({
        monthly_limit_usd: data.monthlyLimitUsd,
        daily_limit_usd: data.dailyLimitUsd,
        alert_threshold: data.alertThreshold,
        provider_limits: data.providerLimits,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (brandId) {
      query = query.eq('brand_id', brandId)
    } else {
      query = query.is('brand_id', null)
    }

    const { data: result, error } = await query.select().single()

    if (error) {
      console.error('Failed to update budget:', error)
      return null
    }

    return result as BudgetConfig
  }

  async updateSpend(userId: string, brandId: string | null, costUsd: number): Promise<void> {
    const supabase = createServerClient()
    if (!supabase) return

    const budget = await this.getBudget(userId, brandId)
    if (!budget) return

    const sb = supabase as any
    let query = sb
      .from('ai_budgets')
      .update({
        current_month_spend: budget.currentMonthSpend + costUsd,
        current_day_spend: budget.currentDaySpend + costUsd,
      })
      .eq('user_id', userId)

    if (brandId) {
      query = query.eq('brand_id', brandId)
    } else {
      query = query.is('brand_id', null)
    }

    await query
  }

  async checkBudget(
    userId: string,
    brandId: string | null,
    costUsd: number,
    provider: string,
  ): Promise<BudgetAlert[]> {
    const budget = await this.getBudget(userId, brandId)
    if (!budget) return []

    const alerts: BudgetAlert[] = []

    await this.updateSpend(userId, brandId, costUsd)

    if (budget.monthlyLimitUsd > 0) {
      const newMonthSpend = budget.currentMonthSpend + costUsd
      const monthPercentage = newMonthSpend / budget.monthlyLimitUsd

      if (monthPercentage >= budget.alertThreshold) {
        const shouldAlert =
          !budget.lastAlertSent ||
          new Date(budget.lastAlertSent) < new Date(Date.now() - 24 * 60 * 60 * 1000)

        if (shouldAlert) {
          alerts.push({
            type: 'monthly',
            threshold: budget.alertThreshold,
            currentSpend: newMonthSpend,
            limit: budget.monthlyLimitUsd,
            percentage: monthPercentage,
            message:
              'Monthly AI cost: $' +
              newMonthSpend.toFixed(2) +
              ' of $' +
              budget.monthlyLimitUsd.toFixed(2) +
              ' (' +
              (monthPercentage * 100).toFixed(0) +
              '%)',
            timestamp: new Date(),
          })

          const supabase = createServerClient()
          if (supabase) {
            const sb = supabase as any
            let query = sb
              .from('ai_budgets')
              .update({ last_alert_sent: new Date().toISOString() })
              .eq('user_id', userId)

            if (brandId) {
              query = query.eq('brand_id', brandId)
            } else {
              query = query.is('brand_id', null)
            }

            await query
          }
        }
      }
    }

    if (budget.dailyLimitUsd && budget.dailyLimitUsd > 0) {
      const newDaySpend = budget.currentDaySpend + costUsd
      const dayPercentage = newDaySpend / budget.dailyLimitUsd

      if (dayPercentage >= budget.alertThreshold) {
        alerts.push({
          type: 'daily',
          threshold: budget.alertThreshold,
          currentSpend: newDaySpend,
          limit: budget.dailyLimitUsd,
          percentage: dayPercentage,
          message:
            'Daily AI cost: $' +
            newDaySpend.toFixed(2) +
            ' of $' +
            budget.dailyLimitUsd.toFixed(2) +
            ' (' +
            (dayPercentage * 100).toFixed(0) +
            '%)',
          timestamp: new Date(),
        })
      }
    }

    const providerLimits = budget.providerLimits as Record<string, number>
    if (providerLimits[provider]) {
      const providerSpend = await this.getProviderSpend(userId, brandId, provider, 30)
      const providerPercentage = providerSpend / providerLimits[provider]

      if (providerPercentage >= budget.alertThreshold) {
        alerts.push({
          type: 'provider',
          threshold: budget.alertThreshold,
          currentSpend: providerSpend,
          limit: providerLimits[provider],
          percentage: providerPercentage,
          message:
            'Provider ' +
            provider +
            ': $' +
            providerSpend.toFixed(2) +
            ' of $' +
            providerLimits[provider].toFixed(2) +
            ' (' +
            (providerPercentage * 100).toFixed(0) +
            '%)',
          timestamp: new Date(),
        })
      }
    }

    return alerts
  }

  async getProviderSpend(
    userId: string,
    brandId: string | null,
    provider: string,
    days: number,
  ): Promise<number> {
    const supabase = createServerClient()
    if (!supabase) return 0

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const sb = supabase as any
    let query = sb
      .from('ai_cost_logs')
      .select('cost_usd')
      .eq('user_id', userId)
      .eq('provider', provider)
      .gte('created_at', startDate.toISOString())

    if (brandId) {
      query = query.eq('brand_id', brandId)
    } else {
      query = query.is('brand_id', null)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to get provider spend:', error)
      return 0
    }

    return (data || []).reduce((sum: number, log: any) => sum + (log.cost_usd || 0), 0)
  }

  async resetDailySpend(userId: string, brandId: string | null): Promise<void> {
    const supabase = createServerClient()
    if (!supabase) return

    const sb = supabase as any
    let query = sb.from('ai_budgets').update({ current_day_spend: 0 }).eq('user_id', userId)

    if (brandId) {
      query = query.eq('brand_id', brandId)
    } else {
      query = query.is('brand_id', null)
    }

    await query
  }

  async resetMonthlySpend(userId: string, brandId: string | null): Promise<void> {
    const supabase = createServerClient()
    if (!supabase) return

    const sb = supabase as any
    let query = sb.from('ai_budgets').update({ current_month_spend: 0 }).eq('user_id', userId)

    if (brandId) {
      query = query.eq('brand_id', brandId)
    } else {
      query = query.is('brand_id', null)
    }

    await query
  }
}
