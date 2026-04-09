import type { AIProviderConfig, AIProviderId, AIProviderRequest, AIProviderResult } from './types'
import { PROVIDER_PRIORITY, PROVIDER_NAMES } from './types'
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
  private healthCacheTtl: number = 60000

  private onProviderFallback?: (from: AIProviderId, to: AIProviderId, error?: string) => void

  constructor(onFallback?: (from: AIProviderId, to: AIProviderId, error?: string) => void) {
    this.providers = new Map()
    this.providerConfigs = new Map()
    this.activeJobs = new Map()
    this.healthCache = new Map()
    this.onProviderFallback = onFallback

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
  }

  async checkAvailability(): Promise<Record<AIProviderId, boolean>> {
    const results: Record<AIProviderId, boolean> = {} as Record<AIProviderId, boolean>

    await Promise.all(
      Array.from(this.providers.entries()).map(async ([id, provider]) => {
        const isAvailable = await provider.isAvailable()
        results[id] = isAvailable
        this.providerConfigs.get(id)!.isAvailable = isAvailable
      }),
    )

    return results
  }

  async getProviderHealth(): Promise<ProviderHealthStatus[]> {
    const now = Date.now()
    const results: ProviderHealthStatus[] = []

    await Promise.all(
      Array.from(this.providers.entries()).map(async ([id, provider]) => {
        const cached = this.healthCache.get(id)
        if (cached && now - cached.timestamp < this.healthCacheTtl) {
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

  async executeWithFallback(request: AIProviderRequest): Promise<AIProviderResult> {
    const sortedProviders = PROVIDER_PRIORITY.map((id) => ({
      id,
      provider: this.providers.get(id)!,
    })).filter(({ provider }) => provider.isConfigured())

    if (sortedProviders.length === 0) {
      return {
        success: false,
        provider: 'gemini',
        error: 'No AI providers configured. Please set up at least one API key.',
      }
    }

    let lastError: string | undefined

    for (const { id, provider } of sortedProviders) {
      const result = await provider.execute(request)

      if (result.success) {
        return result
      }

      lastError = result.error

      const nextProvider = sortedProviders.find((p) => p.id !== id)
      if (nextProvider && this.onProviderFallback) {
        this.onProviderFallback(id, nextProvider.id, result.error)
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

    return provider.execute(request)
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
    return this.providers.delete(id) && this.providerConfigs.delete(id)
  }

  getProviderName(id: AIProviderId): string {
    return PROVIDER_NAMES[id] || id
  }

  getFirstAvailableProvider(): AIProviderId | null {
    for (const id of PROVIDER_PRIORITY) {
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
}

let globalProviderManager: ProviderManager | null = null

export function getProviderManager(): ProviderManager {
  if (!globalProviderManager) {
    globalProviderManager = new ProviderManager()
  }
  return globalProviderManager
}

export function createProviderManager(
  onFallback?: (from: AIProviderId, to: AIProviderId, error?: string) => void,
): ProviderManager {
  globalProviderManager = new ProviderManager(onFallback)
  return globalProviderManager
}
