import type { AIProviderRequest, AIProviderResult } from './types'
import { BaseProvider } from './base-provider'

const GROQ_MODELS = {
  LLAMA_70B: 'llama-3.3-70b-versatile',
  LLAMA_8B: 'llama-3.1-8b-instant',
  MIXTRAL: 'mixtral-8x7b-32768',
  GEMMA: 'gemma2-9b-it',
}

export class GroqProvider extends BaseProvider {
  readonly id = 'groq' as const
  readonly name = 'Groq (Llama)'

  isConfigured(): boolean {
    return !!process.env['GROQ_API_KEY']
  }

  protected override async healthCheckRequest(): Promise<Response> {
    const apiKey = process.env['GROQ_API_KEY']
    return fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
  }

  protected override async executeRequest(request: AIProviderRequest): Promise<Response> {
    const apiKey = process.env['GROQ_API_KEY']

    const messages: { role: string; content: string }[] = []
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }
    messages.push({ role: 'user', content: request.prompt })

    return fetch('https://api.groq.com/openai/v1/chat/completions', {
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
    })
  }

  protected override transformResponse(data: unknown): AIProviderResult {
    const response = data as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { total_tokens?: number }
    }

    const text = response.choices?.[0]?.message?.content || ''
    const tokensUsed = response.usage?.total_tokens || 0

    return {
      success: !!text,
      text,
      provider: this.id,
      tokensUsed,
      costEstimate: this.estimateCost(tokensUsed, 0.00059),
    }
  }
}
