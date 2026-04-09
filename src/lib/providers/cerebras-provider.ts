import type { AIProviderRequest, AIProviderResult } from './types'
import { BaseProvider } from './base-provider'

const CEREBRAS_MODELS = {
  LLAMA_70B: 'llama-4.2-70b-thinking',
  LLAMA_8B: 'qwen-3.7b',
}

export class CerebrasProvider extends BaseProvider {
  readonly id = 'cerebras' as const
  readonly name = 'Cerebras'

  isConfigured(): boolean {
    return !!process.env['CEREBRAS_API_KEY']
  }

  protected override async healthCheckRequest(): Promise<Response> {
    const apiKey = process.env['CEREBRAS_API_KEY']
    return fetch('https://api.cerebras.ai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
  }

  protected override async executeRequest(request: AIProviderRequest): Promise<Response> {
    const apiKey = process.env['CEREBRAS_API_KEY']

    const messages: { role: string; content: string }[] = []
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }
    messages.push({ role: 'user', content: request.prompt })

    return fetch('https://api.cerebras.ai/v1/chat/completions', {
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
      costEstimate: 0,
    }
  }
}
