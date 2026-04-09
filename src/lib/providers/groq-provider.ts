import type { AIProvider, AIProviderRequest, AIProviderResult } from './types'

const GROQ_MODELS = {
  LLAMA_70B: 'llama-3.3-70b-versatile',
  LLAMA_8B: 'llama-3.1-8b-instant',
  MIXTRAL: 'mixtral-8x7b-32768',
  GEMMA: 'gemma2-9b-it',
}

export class GroqProvider implements AIProvider {
  id = 'groq' as const
  name = 'Groq (Llama)'

  isConfigured(): boolean {
    return !!process.env['GROQ_API_KEY']
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isConfigured()) return false
    try {
      const apiKey = process.env['GROQ_API_KEY']
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      return res.ok
    } catch {
      return false
    }
  }

  async execute(request: AIProviderRequest): Promise<AIProviderResult> {
    const startTime = Date.now()
    const apiKey = process.env['GROQ_API_KEY']

    if (!apiKey) {
      return {
        success: false,
        provider: this.id,
        error: 'GROQ_API_KEY not configured',
        latencyMs: Date.now() - startTime,
      }
    }

    try {
      const messages: { role: string; content: string }[] = []

      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt })
      }
      messages.push({ role: 'user', content: request.prompt })

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model || GROQ_MODELS.LLAMA_70B,
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
          error: `Groq API error: ${res.status} - ${errorData.error?.message || 'Unknown'}`,
          latencyMs: Date.now() - startTime,
        }
      }

      const data = await res.json()
      const text = data.choices?.[0]?.message?.content

      if (!text) {
        return {
          success: false,
          provider: this.id,
          error: 'Empty response from Groq',
          latencyMs: Date.now() - startTime,
        }
      }

      return {
        success: true,
        text,
        provider: this.id,
        latencyMs: Date.now() - startTime,
        tokensUsed: data.usage?.total_tokens,
        costEstimate: this.estimateCost(data.usage?.total_tokens || 0),
      }
    } catch (err) {
      return {
        success: false,
        provider: this.id,
        error: err instanceof Error ? err.message : 'Unknown Groq error',
        latencyMs: Date.now() - startTime,
      }
    }
  }

  private estimateCost(tokens: number): number {
    return tokens * 0.00059
  }
}
