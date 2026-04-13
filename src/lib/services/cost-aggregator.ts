// PATH: src/lib/services/cost-aggregator.ts
// Cost Aggregator — Aggregate costs by provider and brand

import { createServerClient } from '@/lib/supabase'
import { getProviderFromModel } from './credit-calculator'

export interface ProviderCost {
  provider: string
  totalCost: number
  totalCredits: number
  requestCount: number
}

export interface BrandCost {
  brandId: string
  brandName: string
  totalCost: number
  totalCredits: number
  requestCount: number
  providers: ProviderCost[]
}

export interface CostReport {
  totalCost: number
  totalCredits: number
  totalRequests: number
  byProvider: ProviderCost[]
  byBrand: BrandCost[]
  period: { from: string; to: string }
}

export async function getCostByProvider(
  workspaceId: string,
  from: string,
  to: string,
): Promise<ProviderCost[]> {
  const db = createServerClient()
  if (!db) throw new Error('Database not configured')

  const { data, error } = await db
    .from('credit_usage')
    .select('provider, cost_credits, credits_used')
    .eq('user_id', workspaceId)
    .gte('created_at', from)
    .lte('created_at', to)

  if (error) throw error

  const providerMap = new Map<string, ProviderCost>()

  for (const row of data || []) {
    const provider = row.provider || 'unknown'
    const existing = providerMap.get(provider) || {
      provider,
      totalCost: 0,
      totalCredits: 0,
      requestCount: 0,
    }

    providerMap.set(provider, {
      provider: existing.provider,
      totalCost: existing.totalCost + (row.cost_credits || 0),
      totalCredits: existing.totalCredits + (row.credits_used || 0),
      requestCount: existing.requestCount + 1,
    })
  }

  return Array.from(providerMap.values()).sort((a, b) => b.totalCost - a.totalCost)
}

export async function getCostByBrand(
  workspaceId: string,
  brandId: string,
  from: string,
  to: string,
): Promise<BrandCost[]> {
  const db = createServerClient()
  if (!db) throw new Error('Database not configured')

  const { data: usageData, error: usageError } = await db
    .from('credit_usage')
    .select('provider, cost_credits, credits_used, brand_id')
    .eq('user_id', workspaceId)
    .eq('brand_id', brandId)
    .gte('created_at', from)
    .lte('created_at', to)

  if (usageError) throw usageError

  const { data: brandData, error: brandError } = await db
    .from('brands')
    .select('id, name')
    .eq('id', brandId)
    .single()

  if (brandError) throw brandError

  const providerMap = new Map<string, ProviderCost>()
  let totalCost = 0
  let totalCredits = 0
  let requestCount = 0

  for (const row of usageData || []) {
    const provider = row.provider || 'unknown'
    const existing = providerMap.get(provider) || {
      provider,
      totalCost: 0,
      totalCredits: 0,
      requestCount: 0,
    }

    providerMap.set(provider, {
      provider: existing.provider,
      totalCost: existing.totalCost + (row.cost_credits || 0),
      totalCredits: existing.totalCredits + (row.credits_used || 0),
      requestCount: existing.requestCount + 1,
    })

    totalCost += row.cost_credits || 0
    totalCredits += row.credits_used || 0
    requestCount++
  }

  return [
    {
      brandId,
      brandName: brandData?.name || 'Unknown',
      totalCost,
      totalCredits,
      requestCount,
      providers: Array.from(providerMap.values()).sort((a, b) => b.totalCost - a.totalCost),
    },
  ]
}

export async function getCostReport(
  workspaceId: string,
  from: string,
  to: string,
): Promise<CostReport> {
  const db = createServerClient()
  if (!db) throw new Error('Database not configured')

  const { data: usageData, error: usageError } = await db
    .from('credit_usage')
    .select('provider, cost_credits, credits_used, brand_id')
    .eq('user_id', workspaceId)
    .gte('created_at', from)
    .lte('created_at', to)

  if (usageError) throw usageError

  const providerMap = new Map<string, ProviderCost>()
  const brandMap = new Map<string, BrandCost>()

  let totalCost = 0
  let totalCredits = 0
  let totalRequests = 0

  for (const row of usageData || []) {
    const provider = row.provider || 'unknown'
    const brandId = row.brand_id || 'unknown'

    const existingProvider = providerMap.get(provider) || {
      provider,
      totalCost: 0,
      totalCredits: 0,
      requestCount: 0,
    }

    providerMap.set(provider, {
      provider: existingProvider.provider,
      totalCost: existingProvider.totalCost + (row.cost_credits || 0),
      totalCredits: existingProvider.totalCredits + (row.credits_used || 0),
      requestCount: existingProvider.requestCount + 1,
    })

    let existingBrand = brandMap.get(brandId)
    if (!existingBrand) {
      existingBrand = {
        brandId,
        brandName: 'Unknown',
        totalCost: 0,
        totalCredits: 0,
        requestCount: 0,
        providers: [],
      }
      brandMap.set(brandId, existingBrand)
    }

    const brandProvider = existingBrand.providers.find((p) => p.provider === provider) || {
      provider,
      totalCost: 0,
      totalCredits: 0,
      requestCount: 0,
    }

    const idx = existingBrand.providers.findIndex((p) => p.provider === provider)
    if (idx >= 0) {
      existingBrand.providers[idx] = {
        ...brandProvider,
        totalCost: brandProvider.totalCost + (row.cost_credits || 0),
        totalCredits: brandProvider.totalCredits + (row.credits_used || 0),
        requestCount: brandProvider.requestCount + 1,
      }
    } else {
      existingBrand.providers.push({
        ...brandProvider,
        totalCost: row.cost_credits || 0,
        totalCredits: row.credits_used || 0,
        requestCount: 1,
      })
    }

    existingBrand.totalCost += row.cost_credits || 0
    existingBrand.totalCredits += row.credits_used || 0
    existingBrand.requestCount++

    totalCost += row.cost_credits || 0
    totalCredits += row.credits_used || 0
    totalRequests++
  }

  if (brandMap.size > 0) {
    const { data: brandIds } = await db
      .from('brands')
      .select('id, name')
      .in('id', Array.from(brandMap.keys()))

    if (brandIds) {
      for (const brand of brandIds) {
        const brandCost = brandMap.get(brand.id)
        if (brandCost) {
          brandCost.brandName = brand.name
        }
      }
    }
  }

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    totalCredits,
    totalRequests,
    byProvider: Array.from(providerMap.values()).sort((a, b) => b.totalCost - a.totalCost),
    byBrand: Array.from(brandMap.values()).sort((a, b) => b.totalCost - a.totalCost),
    period: { from, to },
  }
}

export function getCostFromMonitoring(
  workspaceId: string,
  from: string,
  to: string,
): Promise<CostReport> {
  return getCostReport(workspaceId, from, to)
}
