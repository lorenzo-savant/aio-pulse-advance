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
  override readonly defaultModel = CLAUDE_MODELS.SONNET_4_6

  protected override timeoutMs = 60000

  isConfigured(): boolean {
    return !!process.env['ANTHROPIC_API_KEY']
  }

  /**
   * Liveness probe against a FREE endpoint.
   *
   * This used to POST /v1/messages — a real, billed inference call. It ran on
   * every health-cache miss, and `GET /api/providers/health` is public: rate
   * limited per IP, no auth, with a per-process cache whose floor is 30
   * seconds. Every warm serverless instance held its own cache, so the spend
   * scaled with concurrency and the caller did not have to be logged in.
   *
   * The other three providers already probe their free `/models` endpoints, so
   * this also makes the contract uniform: the health check answers "does this
   * key authenticate", nothing more.
   *
   * It deliberately does NOT answer "does this key have credit". A key with an
   * exhausted balance still returns 200 here — the same blind spot the free
   * endpoints have always had for OpenAI, Gemini and Perplexity. That question
   * is answered from real call failures instead of by paying to ask, because
   * every genuine request already reports it.
   */
  protected override async healthCheckRequest(): Promise<Response> {
    const apiKey = process.env['ANTHROPIC_API_KEY']
    return fetch('https://api.anthropic.com/v1/models?limit=1', {
      headers: {
        'x-api-key': apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
    })
  }

  protected override async executeRequest(
    request: AIProviderRequest,
    signal?: AbortSignal,
  ): Promise<Response> {
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
      signal,
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
