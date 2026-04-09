import type { AIProviderRequest, AIProviderResult } from './types'
import { BaseProvider } from './base-provider'

const OPENROUTER_MODELS = {
  DEEPSEEK: 'deepseek/deepseek-chat-v3-0317',
  GEMINI: 'google/gemini-2.0-flash-001',
  QWEN: 'qwen/qwen-2.5-72b-instruct',
}

export class OpenRouterProvider extends BaseProvider {
  readonly id = 'openrouter' as const
  readonly name = 'OpenRouter'

  isConfigured(): boolean {
    return !!process.env['OPENROUTER_API_KEY']
  }

  protected override async healthCheckRequest(): Promise<Response> {
    const apiKey = process.env['OPENROUTER_API_KEY']
    return fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
  }

  protected override async executeRequest(request: AIProviderRequest): Promise<Response> {
    const apiKey = process.env['OPENROUTER_API_KEY']

    const messages: { role: string; content: string }[] = []
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }
    messages.push({ role: 'user', content: request.prompt })

    return fetch('https://openrouter.ai/api/v1/chat/completions', {
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
      costEstimate: this.estimateCost(tokensUsed, 0.000001),
    }
  }
}
