import type { AIProviderRequest, AIProviderResult } from './types'
import { BaseProvider } from './base-provider'

export interface DataForSEOResult extends AIProviderResult {
  aiOverviews?: Array<{
    text: string
    links: Array<{ title: string; url: string }>
    expand_questions?: string[]
  }>
  peopleAlsoAsk?: Array<{
    question: string
    answer: string
    links: Array<{ title: string; url: string }>
  }>
  searchResultCount?: number
  organicResults?: Array<{
    title: string
    url: string
    snippet: string
    rank: number
  }>
}

interface DataForSEOConfig {
  location_code?: number
  language_code?: string
  device?: 'desktop' | 'mobile' | 'tablet'
  depth?: number
}

const DEFAULT_CONFIG: DataForSEOConfig = {
  location_code: 2840,
  language_code: 'en',
  device: 'desktop',
  depth: 10,
}

export class DataForSEOProvider extends BaseProvider {
  readonly id = 'dataforseo' as const
  readonly name = 'Google AI Overview'

  protected override timeoutMs = 60000

  isConfigured(): boolean {
    return !!process.env['DATAFORSEO_LOGIN'] && !!process.env['DATAFORSEO_KEY']
  }

  protected override async healthCheckRequest(): Promise<Response> {
    const credentials = this.getCredentials()
    return fetch('https://api.dataforseo.com/v3/app', {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    })
  }

  protected override async executeRequest(request: AIProviderRequest): Promise<Response> {
    const credentials = this.getCredentials()
    const config = this.getConfig(request)

    const body = [
      {
        keyword: request.prompt,
        location_code: config.location_code,
        language_code: config.language_code,
        device: config.device,
        depth: config.depth,
        include_answer_box: true,
        include_people_also_ask: true,
        people_also_ask_click_depth: 4,
        include_serp_info: true,
        load_async_ai_overview: true,
      },
    ]

    return fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  protected override transformResponse(data: unknown): DataForSEOResult {
    const response = data as {
      tasks?: Array<{
        result?: Array<{
          se_type?: string
          items?: Array<{
            type?: string
            rank_group?: number
            title?: string
            url?: string
            description?: string
            snippet?: string
            link?: string
            ai_overview?: Array<{
              text?: string
              links?: Array<{ title?: string; url?: string }>
              expand_questions?: string[]
            }>
            answer_box?: {
              title?: string
              description?: string
              links?: Array<{ title?: string; url?: string }>
            }
            people_also_ask?: Array<{
              title?: string
              description?: string
              links?: Array<{ title?: string; url?: string }>
            }>
          }>
        }>
      }>
      status_code?: number
    }

    const taskResult = response.tasks?.[0]?.result?.[0]
    const items = taskResult?.items || []

    const aiOverviews: DataForSEOResult['aiOverviews'] = []
    const peopleAlsoAsk: DataForSEOResult['peopleAlsoAsk'] = []
    const organicResults: DataForSEOResult['organicResults'] = []

    let searchResultCount = 0

    for (const item of items) {
      if (item.type === 'ai_overview' || item.ai_overview) {
        const overview = item.ai_overview?.[0]
        if (overview) {
          aiOverviews.push({
            text: overview.text || '',
            links: (overview.links || []).map((l) => ({
              title: l.title || '',
              url: l.url || '',
            })),
            expand_questions: overview.expand_questions,
          })
        }
      }

      if (item.type === 'people_also_ask' || item.people_also_ask) {
        for (const qa of item.people_also_ask || []) {
          peopleAlsoAsk.push({
            question: qa.title || '',
            answer: qa.description || '',
            links: (qa.links || []).map((l) => ({
              title: l.title || '',
              url: l.url || '',
            })),
          })
        }
      }

      if (item.type === 'organic' && item.url) {
        searchResultCount++
        organicResults.push({
          title: item.title || '',
          url: item.url,
          snippet: item.snippet || item.description || '',
          rank: item.rank_group || searchResultCount,
        })
      }
    }

    const combinedText = this.combineResults(aiOverviews, peopleAlsoAsk, organicResults)

    return {
      success: true,
      text: combinedText,
      provider: this.id,
      aiOverviews,
      peopleAlsoAsk,
      organicResults,
      searchResultCount,
      latencyMs: 0,
    }
  }

  private combineResults(
    aiOverviews: DataForSEOResult['aiOverviews'],
    peopleAlsoAsk: DataForSEOResult['peopleAlsoAsk'],
    organicResults: DataForSEOResult['organicResults'],
  ): string {
    const parts: string[] = []

    if (aiOverviews && aiOverviews.length > 0) {
      parts.push('=== GOOGLE AI OVERVIEW ===')
      for (const overview of aiOverviews) {
        parts.push(overview.text)
        if (overview.links.length > 0) {
          parts.push('Sources: ' + overview.links.map((l) => l.url).join(', '))
        }
      }
    }

    if (peopleAlsoAsk && peopleAlsoAsk.length > 0) {
      parts.push('\n=== PEOPLE ALSO ASK ===')
      for (const qa of peopleAlsoAsk.slice(0, 5)) {
        parts.push(`Q: ${qa.question}\nA: ${qa.answer}`)
      }
    }

    if (organicResults && organicResults.length > 0) {
      parts.push('\n=== TOP ORGANIC RESULTS ===')
      for (const result of organicResults.slice(0, 10)) {
        parts.push(`${result.rank}. ${result.title}\n${result.url}\n${result.snippet}`)
      }
    }

    return parts.join('\n\n')
  }

  private getCredentials(): string {
    const login = process.env['DATAFORSEO_LOGIN'] || ''
    const key = process.env['DATAFORSEO_KEY'] || ''
    return btoa(`${login}:${key}`)
  }

  private getConfig(request: AIProviderRequest): DataForSEOConfig {
    const customConfig = request.model ? JSON.parse(request.model) : {}
    return {
      ...DEFAULT_CONFIG,
      ...customConfig,
    }
  }
}
