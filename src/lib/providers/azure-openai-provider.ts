import type { AIProviderRequest, AIProviderResult } from './types'
import { BaseProvider } from './base-provider'

const AZURE_MODELS = {
  GPT_4O: 'gpt-4o',
  GPT_4O_MINI: 'gpt-4o-mini',
  GPT_4_TURBO: 'gpt-4-turbo',
}

export interface AzureSearchResult extends AIProviderResult {
  citations?: string[]
  webSearchUsed?: boolean
}

export class AzureOpenAIProvider extends BaseProvider {
  readonly id = 'azure-openai' as const
  readonly name = 'Azure OpenAI'

  protected override timeoutMs = 45000

  isConfigured(): boolean {
    return !!(
      process.env['AZURE_OPENAI_API_KEY'] &&
      process.env['AZURE_OPENAI_ENDPOINT'] &&
      process.env['AZURE_OPENAI_DEPLOYMENT_NAME']
    )
  }

  protected override async healthCheckRequest(): Promise<Response> {
    const endpoint = process.env['AZURE_OPENAI_ENDPOINT']
    const apiVersion = '2024-02-15-preview'
    return fetch(`${endpoint}/openai/deployments?api-version=${apiVersion}`, {
      headers: {
        'api-key': process.env['AZURE_OPENAI_API_KEY'] || '',
        'Content-Type': 'application/json',
      },
    })
  }

  protected override async executeRequest(
    request: AIProviderRequest,
    signal?: AbortSignal,
  ): Promise<Response> {
    const endpoint = process.env['AZURE_OPENAI_ENDPOINT']
    const apiKey = process.env['AZURE_OPENAI_API_KEY']
    const deployment = process.env['AZURE_OPENAI_DEPLOYMENT_NAME']
    const apiVersion = '2024-02-15-preview'

    const messages: Array<{ role: string; content: string }> = []

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }

    messages.push({ role: 'user', content: request.prompt })

    const body: Record<string, unknown> = {
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4000,
    }

    if (
      request.model &&
      Object.values(AZURE_MODELS).includes(
        request.model as (typeof AZURE_MODELS)[keyof typeof AZURE_MODELS],
      )
    ) {
      body.model = request.model
    }

    return fetch(
      `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
      {
        method: 'POST',
        headers: {
          'api-key': apiKey || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      },
    )
  }

  protected transformResponse(data: unknown): AzureSearchResult {
    const response = data as {
      choices?: Array<{
        message?: { content: string; role?: string }
        finish_reason?: string
      }>
      usage?: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
      }
      model?: string
    }

    const message = response.choices?.[0]?.message
    const text = message?.content || ''

    const citations: string[] = []
    const citationRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    let match
    while ((match = citationRegex.exec(text)) !== null) {
      const url = match[2]
      if (url && !citations.includes(url)) {
        citations.push(url)
      }
    }

    const tokensUsed = response.usage?.total_tokens || 0
    const inputTokens = response.usage?.prompt_tokens || 0
    const outputTokens = response.usage?.completion_tokens || 0

    return {
      success: true,
      text,
      provider: this.id,
      citations,
      webSearchUsed: false,
      tokensUsed,
      costEstimate: this.calculateCost(inputTokens, outputTokens),
    }
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    const inputRate = 0.000003
    const outputRate = 0.000012
    return inputTokens * inputRate + outputTokens * outputRate
  }
}
