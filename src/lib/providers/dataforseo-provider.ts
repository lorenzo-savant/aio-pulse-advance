import type { AIProviderRequest, AIProviderResult } from './types'
import { BaseProvider } from './base-provider'
import { GEO } from '@/lib/geo-config'

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

// Geo target is driven by GEO (default: Sweden 2752/sv) so SERP / Google
// AI Overview results represent the configured market, independent of the
// serverless egress IP (DataForSEO geolocates server-side by location_code).
const DEFAULT_CONFIG: DataForSEOConfig = {
  location_code: GEO.dataForSeoLocationCode,
  language_code: GEO.dataForSeoLanguageCode,
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

  // ─────────────────────────────────────────────────────────────────
  // KEYWORD RESEARCH — DataForSEO Keywords API
  // ─────────────────────────────────────────────────────────────────

  async getKeywordSuggestions(
    keyword: string,
    locationCode = GEO.dataForSeoLocationCode,
    languageCode = GEO.dataForSeoLanguageCode,
  ): Promise<
    {
      keyword: string
      searchVolume: number
      competition: number
      cpc: number
      trend: number[]
      categories: string[]
    }[]
  > {
    const credentials = this.getCredentials()
    const body = [{ keyword, location_code: locationCode, language_code: languageCode }]

    const response = await fetch(
      'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )

    if (!response.ok) {
      throw new Error(`DataForSEO keywords error ${response.status}: ${await response.text()}`)
    }

    const data = (await response.json()) as {
      tasks?: Array<{
        result?: Array<{
          keyword: string
          search_volume: number
          competition: number
          cpc: number
          trend?: Array<{ year: number; month: number; search_volume: number }>
          categories?: string[]
        }>
      }>
    }

    return (data.tasks?.[0]?.result || []).map((r) => ({
      keyword: r.keyword,
      searchVolume: r.search_volume || 0,
      competition: r.competition || 0,
      cpc: r.cpc || 0,
      trend: (r.trend || []).map((t) => t.search_volume),
      categories: r.categories || [],
    }))
  }

  async getKeywordIdeas(
    seedKeywords: string[],
    locationCode = GEO.dataForSeoLocationCode,
    languageCode = GEO.dataForSeoLanguageCode,
    limit = 100,
  ): Promise<
    {
      keyword: string
      searchVolume: number
      competition: number
      cpc: number
      trend: number[]
    }[]
  > {
    const credentials = this.getCredentials()
    const body = [
      {
        keywords: seedKeywords,
        location_code: locationCode,
        language_code: languageCode,
        sort_by: 'search_volume',
        limit,
      },
    ]

    const response = await fetch(
      'https://api.dataforseo.com/v3/keywords_data/keywords_generator/live',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )

    if (!response.ok) {
      throw new Error(`DataForSEO keyword ideas error ${response.status}: ${await response.text()}`)
    }

    const data = (await response.json()) as {
      tasks?: Array<{
        result?: Array<{
          keyword: string
          search_volume: number
          competition: number
          cpc: number
          trend?: Array<{ search_volume: number }>
        }>
      }>
    }

    return (data.tasks?.[0]?.result || []).map((r) => ({
      keyword: r.keyword,
      searchVolume: r.search_volume || 0,
      competition: r.competition || 0,
      cpc: r.cpc || 0,
      trend: (r.trend || []).map((t) => t.search_volume),
    }))
  }

  // ─────────────────────────────────────────────────────────────────
  // BACKLINK ANALYSIS — DataForSEO Backlinks API
  // ─────────────────────────────────────────────────────────────────

  async getBacklinkSummary(
    target: string,
    mode: 'domain' | 'page' = 'domain',
  ): Promise<{
    rank: number
    backlinksCount: number
    referringDomains: number
    referringPages: number
    eduBacklinks: number
    govBacklinks: number
  }> {
    const credentials = this.getCredentials()
    const endpoint =
      mode === 'domain'
        ? 'https://api.dataforseo.com/v3/backlinks/domain_rank/live'
        : 'https://api.dataforseo.com/v3/backlinks/page_rank/live'

    const body = [{ target, mode }]

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`DataForSEO backlinks error ${response.status}: ${await response.text()}`)
    }

    const data = (await response.json()) as {
      tasks?: Array<{
        result?: Array<{
          rank?: number
          backlinks?: number
          referring_domains?: number
          referring_pages?: number
          edu_backlinks?: number
          gov_backlinks?: number
        }>
      }>
    }

    const r = data.tasks?.[0]?.result?.[0] || {}
    return {
      rank: r.rank || 0,
      backlinksCount: r.backlinks || 0,
      referringDomains: r.referring_domains || 0,
      referringPages: r.referring_pages || 0,
      eduBacklinks: r.edu_backlinks || 0,
      govBacklinks: r.gov_backlinks || 0,
    }
  }

  async getBacklinksList(
    target: string,
    limit = 100,
    offset = 0,
  ): Promise<
    {
      sourceUrl: string
      targetUrl: string
      anchor: string
      linkType: string
      firstSeen: string
      lastSeen: string
    }[]
  > {
    const credentials = this.getCredentials()
    const body = [
      {
        target,
        mode: 'domain',
        limit,
        offset,
        order_by: 'first_seen desc',
      },
    ]

    const response = await fetch('https://api.dataforseo.com/v3/backlinks/referring_domains/live', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(
        `DataForSEO backlinks list error ${response.status}: ${await response.text()}`,
      )
    }

    const data = (await response.json()) as {
      tasks?: Array<{
        result?: Array<{
          domain: string
          backlinks_count: number
        }>
      }>
    }

    return (data.tasks?.[0]?.result || []).map((r) => ({
      sourceUrl: `https://${r.domain}`,
      targetUrl: target,
      anchor: '',
      linkType: 'dofollow',
      firstSeen: '',
      lastSeen: '',
    }))
  }
}
