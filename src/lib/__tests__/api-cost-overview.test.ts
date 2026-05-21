import { describe, it, expect, vi } from 'vitest'

// Mock the supabase client to return null so the function exercises the
// "no DB" / soft-fail paths without needing a real fixture.
vi.mock('@/lib/supabase', () => ({
  createServerClient: () => null,
}))

// Mock the spending monitor too — same idea. Return a stub that mirrors
// what getSpendingSnapshot would return for a "Brave configured, DFS not"
// shape.
vi.mock('@/lib/services/api-spending-monitor', () => ({
  getSpendingSnapshot: vi.fn().mockResolvedValue({
    grade: 'healthy',
    utilization: 0.1,
    totalCostCents: 0,
    providers: [
      {
        provider: 'brave',
        label: '200 / 2000 requests',
        utilization: 0.1,
        costCents: 0,
        configured: true,
        remaining: true,
      },
      {
        provider: 'dataforseo',
        label: 'DataForSEO not configured',
        utilization: 0,
        costCents: 0,
        configured: false,
        remaining: false,
      },
    ],
    advice: 'Healthy: SERP API spending within budget.',
  }),
}))

import { getApiCostOverview } from '../services/api-cost-overview'

describe('getApiCostOverview', () => {
  it('returns a complete snapshot shape even when DB is unavailable', async () => {
    const overview = await getApiCostOverview('test-user-id')

    expect(overview.month).toMatch(/^\d{4}-\d{2}$/)
    expect(typeof overview.totalSpendCents).toBe('number')
    expect(overview.serp).toBeDefined()
    expect(overview.ai).toBeDefined()
    expect(overview.credits).toBeDefined()
  })

  it('parses Brave usage/limit out of the spending-monitor label', async () => {
    const overview = await getApiCostOverview('test-user-id')
    const brave = overview.serp.providers.find((p) => p.provider === 'brave')
    expect(brave).toBeDefined()
    expect(brave?.calls).toBe(200)
    expect(brave?.capCalls).toBe(2000)
    expect(brave?.costCents).toBe(0)
  })

  it('seeds DataForSEO capCents from env or default when DB unavailable', async () => {
    delete process.env['DATAFORSEO_MONTHLY_CAP_CENTS']
    const overview = await getApiCostOverview('test-user-id')
    const dfs = overview.serp.providers.find((p) => p.provider === 'dataforseo')
    expect(dfs).toBeDefined()
    expect(dfs?.capCents).toBe(2000) // default $20

    process.env['DATAFORSEO_MONTHLY_CAP_CENTS'] = '5000'
    const overview2 = await getApiCostOverview('test-user-id')
    const dfs2 = overview2.serp.providers.find((p) => p.provider === 'dataforseo')
    expect(dfs2?.capCents).toBe(5000)
    delete process.env['DATAFORSEO_MONTHLY_CAP_CENTS']
  })

  it('always lists the known AI providers (zero cost) and zero credits when DB unavailable', async () => {
    const overview = await getApiCostOverview('test-user-id')
    // Even without a DB, the 5 canonical providers are surfaced with their
    // configured status so operators see which keys are set.
    const keys = overview.ai.providers.map((p) => p.provider).sort()
    expect(keys).toEqual(['anthropic', 'gemini', 'groq', 'openai', 'perplexity'])
    expect(overview.ai.providers.every((p) => p.costCents === 0)).toBe(true)
    expect(overview.ai.providers.every((p) => typeof p.configured === 'boolean')).toBe(true)
    expect(overview.ai.totalCostCents).toBe(0)
    expect(overview.credits).toEqual({
      purchased: 0,
      used: 0,
      balance: 0,
      earliestExpiry: null,
    })
  })

  it('totalSpendCents == sum of serp + ai totals', async () => {
    const overview = await getApiCostOverview('test-user-id')
    expect(overview.totalSpendCents).toBe(overview.serp.totalCostCents + overview.ai.totalCostCents)
  })
})
