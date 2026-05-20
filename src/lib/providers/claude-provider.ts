import type { AIProviderRequest, AIProviderResult } from './types'
import { BaseProvider } from './base-provider'

const CLAUDE_MODELS = {
  SONNET_4_6: 'claude-sonnet-4-6',
  OPUS_4_6: 'claude-opus-4-6',
  HAIKU_4_5: 'claude-haiku-4-5-20251001',
}

export class ClaudeProvider extends BaseProvider {
  readonly id = 'claude' as const
  readonly name = 'Anthropic Claude'

  protected override timeoutMs = 60000

  isConfigured(): boolean {
    return !!process.env['ANTHROPIC_API_KEY']
  }

  protected override async healthCheckRequest(): Promise<Response> {
    const apiKey = process.env['ANTHROPIC_API_KEY']
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey ?? '',
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODELS.HAIKU_4_5,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    })
  }

  protected override async executeRequest(request: AIProviderRequest): Promise<Response> {
    const apiKey = process.env['ANTHROPIC_API_KEY']

    const body: Record<string, unknown> = {
      model: request.model || CLAUDE_MODELS.SONNET_4_6,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.3,
      messages: [{ role: 'user', content: request.prompt }],
    }

    if (request.systemPrompt) {
      body.system = request.systemPrompt
    }

    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey ?? '',
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  protected override transformResponse(data: unknown): AIProviderResult {
    const response = data as {
      content?: Array<{ type: string; text?: string }>
      usage?: { input_tokens?: number; output_tokens?: number }
    }

    const text = response.content?.find((c) => c.type === 'text')?.text || ''
    const inputTokens = response.usage?.input_tokens ?? 0
    const outputTokens = response.usage?.output_tokens ?? 0
    const tokensUsed = inputTokens + outputTokens

    return {
      success: !!text,
      text,
      provider: this.id,
      tokensUsed,
      costEstimate: this.calculateCost(inputTokens, outputTokens),
    }
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    const inputRate = 0.000003
    const outputRate = 0.000015
    return inputTokens * inputRate + outputTokens * outputRate
  }
}
