import type { AIProvider, AIProviderRequest, AIProviderResult } from './types'

const CEREBRAS_MODELS = {
  LLAMA_70B: 'llama-4.2-70b-thinking',
  LLAMA_8B: 'qwen-3.7b',
}

export class CerebrasProvider implements AIProvider {
  id = 'cerebras' as const
  name = 'Cerebras'

  isConfigured(): boolean {
    return !!process.env['CEREBRAS_API_KEY']
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isConfigured()) return false
    try {
      const apiKey = process.env['CEREBRAS_API_KEY']
      const res = await fetch('https://api.cerebras.ai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      return res.ok
    } catch {
      return false
    }
  }

  async execute(request: AIProviderRequest): Promise<AIProviderResult> {
    const startTime = Date.now()
    const apiKey = process.env['CEREBRAS_API_KEY']

    if (!apiKey) {
      return {
        success: false,
        provider: this.id,
        error: 'CEREBRAS_API_KEY not configured',
        latencyMs: Date.now() - startTime,
      }
    }

    try {
      const messages: { role: string; content: string }[] = []

      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt })
      }
      messages.push({ role: 'user', content: request.prompt })

      const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model || CEREBRAS_MODELS.LLAMA_70B,
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
          error: `Cerebras API error: ${res.status} - ${errorData.error?.message || 'Unknown'}`,
          latencyMs: Date.now() - startTime,
        }
      }

      const data = await res.json()
      const text = data.choices?.[0]?.message?.content

      if (!text) {
        return {
          success: false,
          provider: this.id,
          error: 'Empty response from Cerebras',
          latencyMs: Date.now() - startTime,
        }
      }

      return {
        success: true,
        text,
        provider: this.id,
        latencyMs: Date.now() - startTime,
        tokensUsed: data.usage?.total_tokens,
        costEstimate: 0,
      }
    } catch (err) {
      return {
        success: false,
        provider: this.id,
        error: err instanceof Error ? err.message : 'Unknown Cerebras error',
        latencyMs: Date.now() - startTime,
      }
    }
  }
}
