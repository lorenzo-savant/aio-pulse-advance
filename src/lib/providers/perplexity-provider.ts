import type { AIProviderRequest, AIProviderResult } from './types'
import { BaseProvider } from './base-provider'

const PERPLEXITY_MODELS = {
  SONAR_PRO: 'sonar-pro',
  SONAR: 'sonar',
}

export interface PerplexityResult extends AIProviderResult {
  citations?: string[]
  searchResults?: Array<{ title: string; url: string; hostname: string }>
  relatedQuestions?: string[]
}

export class PerplexityProvider extends BaseProvider {
  readonly id = 'perplexity' as const
  readonly name = 'Perplexity'

  isConfigured(): boolean {
    return !!process.env['PERPLEXITY_API_KEY']
  }

  protected override async healthCheckRequest(): Promise<Response> {
    const apiKey = process.env['PERPLEXITY_API_KEY']
    return fetch('https://api.perplexity.ai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
  }

  protected override async executeRequest(request: AIProviderRequest): Promise<Response> {
    const apiKey = process.env['PERPLEXITY_API_KEY']

    const messages: { role: string; content: string }[] = []
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }
    messages.push({ role: 'user', content: request.prompt })

    return fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model || PERPLEXITY_MODELS.SONAR_PRO,
        messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 1000,
        return_citations: true,
        search_recency_filter: 'm',
      }),
    })
  }

  protected override transformResponse(data: unknown): PerplexityResult {
    const response = data as {
      choices?: Array<{
        message?: { content?: string }
        finish_reason?: string
      }>
      citations?: string[]
      related_questions?: string[]
      usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number }
    }

    const text = response.choices?.[0]?.message?.content || ''

    const citations: string[] = []
    const searchResults: Array<{ title: string; url: string; hostname: string }> = []

    if (response.citations) {
      for (const url of response.citations) {
        if (url) {
          citations.push(url)
          try {
            const hostname = new URL(url).hostname
            searchResults.push({ title: hostname, url, hostname })
          } catch {
            searchResults.push({ title: url, url, hostname: url })
          }
        }
      }
    }

    const citationRegex = /\[(\d+)\]/g
    const matchedCitations = new Set<string>()
    let match
    while ((match = citationRegex.exec(text)) !== null) {
      const index = parseInt(match[1]!, 10) - 1
      if (citations[index]) {
        matchedCitations.add(citations[index]!)
      }
    }

    const urlRegex = /https?:\/\/[^\s\)\]]+/g
    const textUrls = text.match(urlRegex) || []
    for (const url of textUrls) {
      if (!matchedCitations.has(url) && url.startsWith('http')) {
        matchedCitations.add(url)
        try {
          const hostname = new URL(url).hostname
          searchResults.push({ title: hostname, url, hostname })
        } catch {
          searchResults.push({ title: url, url, hostname: url })
        }
      }
    }

    const tokensUsed = response.usage?.total_tokens || 0

    return {
      success: true,
      text,
      provider: this.id,
      citations: Array.from(matchedCitations),
      searchResults: searchResults.slice(0, 5),
      relatedQuestions: response.related_questions,
      tokensUsed,
      costEstimate: this.calculateCost(tokensUsed),
    }
  }

  private calculateCost(tokens: number): number {
    return tokens * 0.0000035
  }
}
