import type { AIProvider, AIProviderRequest, AIProviderResult } from './types'

const OPENROUTER_MODELS = {
  DEEPSEEK: 'deepseek/deepseek-chat-v3-0317',
  GEMINI: 'google/gemini-2.0-flash-001',
  QWEN: 'qwen/qwen-2.5-72b-instruct',
}

export class OpenRouterProvider implements AIProvider {
  id = 'openrouter' as const
  name = 'OpenRouter'

  isConfigured(): boolean {
    return !!process.env['OPENROUTER_API_KEY']
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isConfigured()) return false
    try {
      const apiKey = process.env['OPENROUTER_API_KEY']
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      return res.ok
    } catch {
      return false
    }
  }

  async execute(request: AIProviderRequest): Promise<AIProviderResult> {
    const startTime = Date.now()
    const apiKey = process.env['OPENROUTER_API_KEY']

    if (!apiKey) {
      return {
        success: false,
        provider: this.id,
        error: 'OPENROUTER_API_KEY not configured',
        latencyMs: Date.now() - startTime,
      }
    }

    try {
      const messages: { role: string; content: string }[] = []

      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt })
      }
      messages.push({ role: 'user', content: request.prompt })

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env['NEXT_PUBLIC_SITE_URL'] || 'https://aio-pulse.com',
          'X-Title': 'AIO Pulse',
        },
        body: JSON.stringify({
          model: request.model || OPENROUTER_MODELS.DEEPSEEK,
          messages,
          temperature: request.temperature ?? 0.3,
          max_tokens: request.maxTokens ?? 4096,
        }),
        signal: AbortSignal.timeout(30000),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        return {
          success: false,
          provider: this.id,
          error: `OpenRouter API error: ${res.status} - ${errorData.error?.message || 'Unknown'}`,
          latencyMs: Date.now() - startTime,
        }
      }

      const data = await res.json()
      const text = data.choices?.[0]?.message?.content

      if (!text) {
        return {
          success: false,
          provider: this.id,
          error: 'Empty response from OpenRouter',
          latencyMs: Date.now() - startTime,
        }
      }

      return {
        success: true,
        text,
        provider: this.id,
        latencyMs: Date.now() - startTime,
        tokensUsed: data.usage?.total_tokens,
        costEstimate: data.usage?.total_tokens ? data.usage.total_tokens * 0.000001 : 0,
      }
    } catch (err) {
      return {
        success: false,
        provider: this.id,
        error: err instanceof Error ? err.message : 'Unknown OpenRouter error',
        latencyMs: Date.now() - startTime,
      }
    }
  }
}
