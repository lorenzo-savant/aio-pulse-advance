import type { AIProviderConfig, AIProviderId, AIProviderRequest, AIProviderResult } from './types'
import {
  PROVIDER_PRIORITY,
  PROVIDER_NAMES,
  DEFAULT_TIMEOUT_CONFIG,
  type ProviderTimeoutConfig,
} from './types'
import { GeminiProvider } from './gemini-provider'
import { GroqProvider } from './groq-provider'
import { CerebrasProvider } from './cerebras-provider'
import { OpenRouterProvider } from './openrouter-provider'
import { ChatGPTProvider } from './chatgpt-provider'
import { PerplexityProvider } from './perplexity-provider'
import { DataForSEOProvider } from './dataforseo-provider'
import { AzureOpenAIProvider } from './azure-openai-provider'
import { BaseProvider } from './base-provider'
import { enrichPromptWithBrandContext, type BrandContextOptions } from '../brand-enrichment'
import type { Brand } from '@/types'

export interface JobResult {
  results: AIProviderResult[]
  aggregatedData: {
    bestResult: AIProviderResult | null
    totalCost: number
    totalTokens: number
    averageLatencyMs: number
    confidence: number
    usedProviders: AIProviderId[]
  }
}

export interface ProviderHealthStatus {
  id: AIProviderId
  name: string
  isConfigured: boolean
  isAvailable: boolean
  latencyMs?: number
  lastChecked: string
}

export interface ProviderManagerConfig {
  baseHealthCacheTtl?: number
  mruCacheSize?: number
  mruCacheTtl?: number
  dynamicReorderEnabled?: boolean
  onCreditDeduction?: (provider: AIProviderId, cost: number) => void
  onSlowProvider?: (provider: AIProviderId, latencyMs: number, threshold: number) => void
}

function generateJobKey(request: AIProviderRequest, providerId?: AIProviderId): string {
  const parts = [
    providerId || 'all',
    request.prompt.slice(0, 100),
    request.temperature ?? 0.3,
    request.maxTokens ?? 4096,
  ]
  return parts.join('|')
}

export class ProviderManager {
  private providers: Map<AIProviderId, BaseProvider>
  private providerConfigs: Map<AIProviderId, AIProviderConfig>
  private activeJobs: Map<string, Promise<JobResult[]>>
  private healthCache: Map<AIProviderId, { status: ProviderHealthStatus; timestamp: number }>
  private baseHealthCacheTtl: number
  private mruCache: Map<string, { result: AIProviderResult; timestamp: number }>
  private mruCacheSize: number
  private mruCacheTtl: number
  private dynamicReorderEnabled: boolean
  private providerLatencies: Map<AIProviderId, number[]>
  private onCreditDeduction?: (provider: AIProviderId, cost: number) => void
  private onSlowProvider?: (provider: AIProviderId, latencyMs: number, threshold: number) => void
  private onProviderFallback?: (from: AIProviderId, to: AIProviderId, error?: string) => void

  constructor(config?: ProviderManagerConfig) {
    this.providers = new Map()
    this.providerConfigs = new Map()
    this.activeJobs = new Map()
    this.healthCache = new Map()
    this.baseHealthCacheTtl = config?.baseHealthCacheTtl ?? 60000
    this.mruCacheSize = config?.mruCacheSize ?? 100
    this.mruCacheTtl = config?.mruCacheTtl ?? 300000
    this.dynamicReorderEnabled = config?.dynamicReorderEnabled ?? true
    this.mruCache = new Map()
    this.providerLatencies = new Map()
    this.onCreditDeduction = config?.onCreditDeduction
    this.onSlowProvider = config?.onSlowProvider

    this.registerProvider(new ChatGPTProvider())
    this.registerProvider(new GeminiProvider())
    this.registerProvider(new PerplexityProvider())
    this.registerProvider(new AzureOpenAIProvider())
    this.registerProvider(new GroqProvider())
    this.registerProvider(new CerebrasProvider())
    this.registerProvider(new OpenRouterProvider())
    this.registerProvider(new DataForSEOProvider())
  }

  private registerProvider(provider: BaseProvider): void {
    this.providers.set(provider.id, provider)
    const priority = PROVIDER_PRIORITY.indexOf(provider.id)
    this.providerConfigs.set(provider.id, {
      id: provider.id,
      name: provider.name,
      enabled: true,
      priority,
      isAvailable: false,
    })
    this.providerLatencies.set(provider.id, [])
  }

  setFallbackCallback(
    callback: (from: AIProviderId, to: AIProviderId, error?: string) => void,
  ): void {
    this.onProviderFallback = callback
  }

  private getDynamicTtl(providerId: AIProviderId): number {
    const latencies = this.providerLatencies.get(providerId) ?? []
    if (latencies.length === 0) return this.baseHealthCacheTtl

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
    return Math.min(Math.max(avgLatency * 2, 30000), 300000)
  }

  private updateProviderLatency(providerId: AIProviderId, latencyMs: number): void {
    const latencies = this.providerLatencies.get(providerId) ?? []
    latencies.push(latencyMs)
    if (latencies.length > 10) latencies.shift()
    this.providerLatencies.set(providerId, latencies)
  }

  private getSortedProviders(): Array<{
    id: AIProviderId
    provider: BaseProvider
    avgLatency: number
  }> {
    return PROVIDER_PRIORITY.map((id) => {
      const provider = this.providers.get(id)
      if (!provider) return null
      const latencies = this.providerLatencies.get(id) ?? []
      const avgLatency =
        latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 10000
      return { id, provider, avgLatency }
    })
      .filter(
        (p): p is { id: AIProviderId; provider: BaseProvider; avgLatency: number } => p !== null,
      )
      .sort((a, b) => a.avgLatency - b.avgLatency)
  }

  private getMRUCachedResult(request: AIProviderRequest): AIProviderResult | null {
    const key = generateJobKey(request)
    const cached = this.mruCache.get(key)
    if (!cached) return null

    const now = Date.now()
    if (now - cached.timestamp > this.mruCacheTtl) {
      this.mruCache.delete(key)
      return null
    }

    return { ...cached.result, cached: true }
  }

  private setMRUCachedResult(request: AIProviderRequest, result: AIProviderResult): void {
    if (!result.success) return

    const key = generateJobKey(request)
    this.mruCache.set(key, { result, timestamp: Date.now() })

    if (this.mruCache.size > this.mruCacheSize) {
      const oldestKey = this.mruCache.keys().next().value
      if (oldestKey) this.mruCache.delete(oldestKey)
    }
  }

  async checkAvailability(): Promise<Record<AIProviderId, boolean>> {
    const results: Record<AIProviderId, boolean> = {} as Record<AIProviderId, boolean>

    await Promise.all(
      Array.from(this.providers.entries()).map(async ([id, provider]) => {
        const isAvailable = await provider.isAvailable()
        results[id] = isAvailable
        const config = this.providerConfigs.get(id)
        if (config) {
          config.isAvailable = isAvailable
        }
      }),
    )

    return results
  }

  async getProviderHealth(): Promise<ProviderHealthStatus[]> {
    const now = Date.now()
    const results: ProviderHealthStatus[] = []

    await Promise.all(
      Array.from(this.providers.entries()).map(async ([id, provider]) => {
        const ttl = this.getDynamicTtl(id)
        const cached = this.healthCache.get(id)
        if (cached && now - cached.timestamp < ttl) {
          results.push(cached.status)
          return
        }

        const startTime = Date.now()
        const isAvailable = await provider.isAvailable()
        const latencyMs = Date.now() - startTime

        const status: ProviderHealthStatus = {
          id,
          name: provider.name,
          isConfigured: provider.isConfigured(),
          isAvailable,
          latencyMs,
          lastChecked: new Date().toISOString(),
        }

        this.healthCache.set(id, { status, timestamp: now })
        this.updateProviderLatency(id, latencyMs)
        results.push(status)
      }),
    )

    return results
  }

  getConfigs(): AIProviderConfig[] {
    return Array.from(this.providerConfigs.values()).sort((a, b) => a.priority - b.priority)
  }

  getConfig(id: AIProviderId): AIProviderConfig | undefined {
    return this.providerConfigs.get(id)
  }

  isProviderAvailable(id: AIProviderId): boolean {
    return this.providerConfigs.get(id)?.isAvailable ?? false
  }

  isProviderConfigured(id: AIProviderId): boolean {
    return this.providers.get(id)?.isConfigured() ?? false
  }

  private getTimeoutConfig(providerId: AIProviderId): ProviderTimeoutConfig {
    return (
      DEFAULT_TIMEOUT_CONFIG[providerId] ?? { warningMs: 5000, timeoutMs: 60000, maxRetries: 1 }
    )
  }

  private async executeWithTimeout<T>(
    providerId: AIProviderId,
    fn: () => Promise<T>,
  ): Promise<{ result: T; timedOut: boolean; latencyMs: number }> {
    const config = this.getTimeoutConfig(providerId)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs)

    const startTime = Date.now()
    try {
      const result = await fn()
      clearTimeout(timeoutId)
      const latencyMs = Date.now() - startTime

      if (latencyMs > config.warningMs) {
        this.onSlowProvider?.(providerId, latencyMs, config.warningMs)
      }

      return { result, timedOut: false, latencyMs }
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  async executeWithFallback(request: AIProviderRequest): Promise<AIProviderResult> {
    const cachedResult = this.getMRUCachedResult(request)
    if (cachedResult) {
      return cachedResult
    }

    const sortedProviders = this.dynamicReorderEnabled
      ? this.getSortedProviders().filter(({ provider }) => provider.isConfigured())
      : PROVIDER_PRIORITY.map((id) => ({
          id,
          provider: this.providers.get(id)!,
          avgLatency: 0,
        })).filter(({ provider }) => provider?.isConfigured())

    if (sortedProviders.length === 0) {
      return {
        success: false,
        provider: 'gemini',
        error: 'No AI providers configured. Please set up at least one API key.',
      }
    }

    let lastError: string | undefined

    for (const { id, provider } of sortedProviders) {
      try {
        const { result, latencyMs } = await this.executeWithTimeout(id, () =>
          provider.execute(request),
        )

        this.updateProviderLatency(id, latencyMs)

        if (result.costEstimate && result.costEstimate > 0) {
          this.onCreditDeduction?.(id, result.costEstimate)
        }

        if (result.success) {
          this.setMRUCachedResult(request, result)
          return result
        }

        lastError = result.error

        const nextProvider = sortedProviders.find((p) => p.id !== id)
        if (nextProvider && this.onProviderFallback) {
          this.onProviderFallback(id, nextProvider.id, result.error)
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error'
        const nextProvider = sortedProviders.find((p) => p.id !== id)
        if (nextProvider && this.onProviderFallback) {
          this.onProviderFallback(id, nextProvider.id, lastError)
        }
      }
    }

    return {
      success: false,
      provider: sortedProviders[0]!.id,
      error: `All providers failed. Last error: ${lastError}`,
    }
  }

  async executeWithProvider(
    request: AIProviderRequest,
    providerId: AIProviderId,
  ): Promise<AIProviderResult> {
    const provider = this.providers.get(providerId)
    if (!provider) {
      return {
        success: false,
        provider: providerId,
        error: `Unknown provider: ${providerId}`,
      }
    }

    if (!provider.isConfigured()) {
      return {
        success: false,
        provider: providerId,
        error: `${PROVIDER_NAMES[providerId]} is not configured`,
      }
    }

    try {
      const { result, latencyMs } = await this.executeWithTimeout(providerId, () =>
        provider.execute(request),
      )
      this.updateProviderLatency(providerId, latencyMs)

      if (result.costEstimate && result.costEstimate > 0) {
        this.onCreditDeduction?.(providerId, result.costEstimate)
      }

      return result
    } catch (error) {
      return {
        success: false,
        provider: providerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async executeWithPreferred(
    request: AIProviderRequest,
    preferredProvider: AIProviderId | null,
  ): Promise<AIProviderResult> {
    if (preferredProvider) {
      const result = await this.executeWithProvider(request, preferredProvider)
      if (result.success) {
        return result
      }

      return this.executeWithFallback({
        ...request,
        prompt: `Original request failed with ${preferredProvider}. Retrying with fallback.\n\n${request.prompt}`,
      })
    }

    return this.executeWithFallback(request)
  }

  async executeWithBrandContext(
    request: AIProviderRequest,
    brand: Brand | null,
    brandOptions?: BrandContextOptions,
  ): Promise<AIProviderResult> {
    const enrichedRequest = {
      ...request,
      prompt: enrichPromptWithBrandContext(request.prompt, brand, brandOptions),
    }
    return this.executeWithFallback(enrichedRequest)
  }

  async executeWithBrandAndProvider(
    request: AIProviderRequest,
    brand: Brand | null,
    providerId: AIProviderId,
    brandOptions?: BrandContextOptions,
  ): Promise<AIProviderResult> {
    const enrichedRequest = {
      ...request,
      prompt: enrichPromptWithBrandContext(request.prompt, brand, brandOptions),
    }
    return this.executeWithProvider(enrichedRequest, providerId)
  }

  async executeParallelWithBrand(
    requests: AIProviderRequest[],
    brand: Brand | null,
    brandOptions?: BrandContextOptions,
  ): Promise<JobResult[]> {
    const enrichedRequests = requests.map((req) => ({
      ...req,
      prompt: enrichPromptWithBrandContext(req.prompt, brand, brandOptions),
    }))
    return this.executeParallel(enrichedRequests)
  }

  async executeParallel(requests: AIProviderRequest[]): Promise<JobResult[]> {
    const jobKey = `batch|${requests.length}`

    const existingJob = this.activeJobs.get(jobKey)
    if (existingJob) {
      return existingJob
    }

    const jobPromise = this.executeParallelInternal(requests)
    this.activeJobs.set(jobKey, jobPromise)

    try {
      return await jobPromise
    } finally {
      this.activeJobs.delete(jobKey)
    }
  }

  private async executeParallelInternal(requests: AIProviderRequest[]): Promise<JobResult[]> {
    const promises = requests.map((request) => this.executeWithFallback(request))
    const results = await Promise.allSettled(promises)

    return results.map((result) => {
      if (result.status === 'fulfilled') {
        return this.aggregateResults([result.value])
      }
      return this.aggregateResults([
        {
          success: false,
          provider: 'gemini' as AIProviderId,
          error: result.reason?.message || 'Unknown error',
        },
      ])
    })
  }

  private aggregateResults(results: AIProviderResult[]): JobResult {
    const successfulResults = results.filter((r) => r.success)
    const usedProviders = results.map((r) => r.provider)

    const totalCost = results.reduce((sum, r) => sum + (r.costEstimate ?? 0), 0)
    const totalTokens = results.reduce((sum, r) => sum + (r.tokensUsed ?? 0), 0)
    const latencies = results.map((r) => r.latencyMs ?? 0).filter((l) => l > 0)
    const averageLatencyMs =
      latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0

    const baseConfidence = 0.8
    const responseTimePenalty = Math.min(averageLatencyMs / 10000, 0.2)
    const confidence = Math.max(0, baseConfidence - responseTimePenalty)

    let bestResult: AIProviderResult | null = null
    if (successfulResults.length > 0) {
      bestResult = successfulResults.reduce((best, current) => {
        const bestScore = (best.tokensUsed ?? 0) / Math.max(1, best.latencyMs ?? 1)
        const currentScore = (current.tokensUsed ?? 0) / Math.max(1, current.latencyMs ?? 1)
        return currentScore > bestScore ? current : best
      })
    }

    return {
      results,
      aggregatedData: {
        bestResult,
        totalCost,
        totalTokens,
        averageLatencyMs,
        confidence,
        usedProviders,
      },
    }
  }

  addProvider(provider: BaseProvider): void {
    this.registerProvider(provider)
  }

  removeProvider(id: AIProviderId): boolean {
    this.providerLatencies.delete(id)
    return this.providers.delete(id) && this.providerConfigs.delete(id)
  }

  getProviderName(id: AIProviderId): string {
    return PROVIDER_NAMES[id] || id
  }

  getFirstAvailableProvider(): AIProviderId | null {
    const sorted = this.getSortedProviders()
    for (const { id } of sorted) {
      if (this.isProviderAvailable(id)) {
        return id
      }
    }
    return null
  }

  getConfiguredProviders(): AIProviderId[] {
    return PROVIDER_PRIORITY.filter((id) => this.isProviderConfigured(id))
  }

  getActiveJobsCount(): number {
    return this.activeJobs.size
  }

  clearHealthCache(): void {
    this.healthCache.clear()
  }

  clearMRUCache(): void {
    this.mruCache.clear()
  }

  getProviderStats(): Record<
    AIProviderId,
    { avgLatency: number; successRate: number; callCount: number }
  > {
    const stats: Record<string, { latencies: number[]; successes: number; total: number }> = {}

    for (const [id, latencies] of this.providerLatencies.entries()) {
      stats[id] = {
        latencies,
        successes: 0,
        total: 0,
      }
    }

    for (const [, { result }] of this.mruCache.entries()) {
      const providerStats = stats[result.provider]
      if (providerStats) {
        providerStats.total++
        if (result.success) providerStats.successes++
      }
    }

    const result: Record<
      AIProviderId,
      { avgLatency: number; successRate: number; callCount: number }
    > = {} as Record<AIProviderId, { avgLatency: number; successRate: number; callCount: number }>

    for (const id of PROVIDER_PRIORITY) {
      const s = stats[id] ?? { latencies: [], successes: 0, total: 0 }
      const avgLatency =
        s.latencies.length > 0 ? s.latencies.reduce((a, b) => a + b, 0) / s.latencies.length : 0
      result[id] = {
        avgLatency,
        successRate: s.total > 0 ? s.successes / s.total : 0,
        callCount: s.total,
      }
    }

    return result
  }
}

let globalProviderManager: ProviderManager | null = null

export function getProviderManager(): ProviderManager {
  if (!globalProviderManager) {
    globalProviderManager = new ProviderManager()
  }
  return globalProviderManager
}

export function createProviderManager(config?: ProviderManagerConfig): ProviderManager {
  globalProviderManager = new ProviderManager(config)
  return globalProviderManager
}
