import { getProviderManager, type AIProviderId } from '@/lib/providers'
import type { AIProviderRequest } from '@/lib/providers'

export interface AIResponse {
  text: string
  provider: AIProviderId
  latencyMs?: number
  tokensUsed?: number
  costEstimate?: number
}

export async function callAI(
  prompt: string,
  options: {
    systemPrompt?: string
    preferredProvider?: AIProviderId | null
    temperature?: number
    maxTokens?: number
  } = {},
): Promise<AIResponse> {
  const manager = getProviderManager()

  const request: AIProviderRequest = {
    prompt,
    systemPrompt: options.systemPrompt,
    temperature: options.temperature ?? 0.3,
    maxTokens: options.maxTokens ?? 4096,
  }

  const result = options.preferredProvider
    ? await manager.executeWithPreferred(request, options.preferredProvider)
    : await manager.executeWithFallback(request)

  if (!result.success) {
    throw new Error(result.error || 'AI request failed')
  }

  return {
    text: result.text!,
    provider: result.provider,
    latencyMs: result.latencyMs,
    tokensUsed: result.tokensUsed,
    costEstimate: result.costEstimate,
  }
}

export async function checkProvidersAvailability(): Promise<Record<AIProviderId, boolean>> {
  const manager = getProviderManager()
  return manager.checkAvailability()
}

export function getConfiguredProviders(): AIProviderId[] {
  const manager = getProviderManager()
  return manager.getConfiguredProviders()
}
