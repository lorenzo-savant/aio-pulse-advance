import type { AIProviderConfig, AIProviderId, AIProviderRequest, AIProviderResult } from './types'
import { PROVIDER_PRIORITY, PROVIDER_NAMES } from './types'
import { GeminiProvider } from './gemini-provider'
import { GroqProvider } from './groq-provider'
import { CerebrasProvider } from './cerebras-provider'
import { OpenRouterProvider } from './openrouter-provider'
import { ChatGPTProvider } from './chatgpt-provider'
import { PerplexityProvider } from './perplexity-provider'
import { DataForSEOProvider } from './dataforseo-provider'
import { BaseProvider } from './base-provider'

export class ProviderManager {
  private providers: Map<AIProviderId, BaseProvider>
  private providerConfigs: Map<AIProviderId, AIProviderConfig>
  private onProviderFallback?: (from: AIProviderId, to: AIProviderId, error?: string) => void

  constructor(onFallback?: (from: AIProviderId, to: AIProviderId, error?: string) => void) {
    this.providers = new Map()
    this.providerConfigs = new Map()
    this.onProviderFallback = onFallback

    this.registerProvider(new ChatGPTProvider())
    this.registerProvider(new GeminiProvider())
    this.registerProvider(new PerplexityProvider())
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
