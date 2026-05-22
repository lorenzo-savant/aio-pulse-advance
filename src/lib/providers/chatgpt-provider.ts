import type { AIProviderRequest, AIProviderResult } from './types'
import { BaseProvider } from './base-provider'

const CHATGPT_MODELS = {
  GPT_4_1: 'gpt-4.1',
  GPT_4O: 'gpt-4o',
  GPT_4O_MINI: 'gpt-4o-mini',
}

export interface ChatGPTSearchResult extends AIProviderResult {
  citations?: string[]
  searchResults?: Array<{ title: string; url: string }>
  webSearchUsed?: boolean
}

export class ChatGPTProvider extends BaseProvider {
  readonly id = 'chatgpt' as const
  readonly name = 'ChatGPT Search'

  protected override timeoutMs = 45000

  isConfigured(): boolean {
    return !!process.env['OPENAI_API_KEY']
  }

  protected override async healthCheckRequest(): Promise<Response> {
    const apiKey = process.env['OPENAI_API_KEY']
    return fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
  }

  protected override async executeRequest(
    request: AIProviderRequest,
    signal?: AbortSignal,
  ): Promise<Response> {
    const apiKey = process.env['OPENAI_API_KEY']

    const body: Record<string, unknown> = {
      model: request.model || CHATGPT_MODELS.GPT_4_1,
      input: request.prompt,
      tools: [{ type: 'web_search_preview' }],
      temperature: request.temperature ?? 0.7,
    }

    if (request.systemPrompt) {
      body.tools = [
        ...(body.tools as unknown[]),
        {
          type: 'function',
          name: 'system',
          description: 'System instructions',
          parameters: { type: 'object', properties: {} },
        },
      ]
    }

    return fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    })
  }

  protected transformResponse(data: unknown): ChatGPTSearchResult {
    const response = data as {
      output?: Array<{
        type: string
        content?: Array<{ type: string; text?: string; citations?: unknown[] }>
      }>
      usage?: { input_tokens: number; output_tokens: number; total_tokens: number }
      service_tier?: string
    }

    const outputText = response.output?.find(
      (o) => o.type === 'message' || o.type === 'output_text',
    )
    const textContent = outputText?.content?.find(
      (c) => c.type === 'text' || c.type === 'output_text',
    )
    const text = textContent?.text || ''

    const citations: string[] = []
    const searchResults: Array<{ title: string; url: string }> = []

    if (textContent?.citations) {
      for (const citation of textContent.citations) {
        const cite = citation as { url?: string; title?: string }
        if (cite.url) {
          citations.push(cite.url)
          searchResults.push({ title: cite.title || cite.url, url: cite.url })
        }
      }
    }

    const citationRegex = /\[(\d+)\]/g
    const matchedCitations = new Set<string>()
    let match
    while ((match = citationRegex.exec(text)) !== null) {
      const index = parseInt(match[1]!, 10) - 1
      if (searchResults[index]) {
        matchedCitations.add(searchResults[index]!.url)
      }
    }

    const tokensUsed = response.usage?.total_tokens || 0
    const inputTokens = response.usage?.input_tokens || 0
    const outputTokens = response.usage?.output_tokens || 0

    return {
      success: true,
      text,
      provider: this.id,
      citations: Array.from(matchedCitations),
      searchResults,
      webSearchUsed: true,
      tokensUsed,
      costEstimate: this.calculateCost(inputTokens, outputTokens),
    }
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    const inputRate = 0.0000025
    const outputRate = 0.00001
    return inputTokens * inputRate + outputTokens * outputRate
  }
}
