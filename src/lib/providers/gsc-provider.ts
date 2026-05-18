import { BaseProvider } from './base-provider'
import type { AIProviderId, AIProviderRequest, AIProviderResult } from './types'

export interface GscQueryParams {
  startDate: string
  endDate: string
  dimensions?: ('query' | 'page' | 'country' | 'device' | 'date')[]
  rowLimit?: number
  searchType?: 'web' | 'image' | 'video' | 'news'
}

export interface GscRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface GscApiResponse {
  rows: GscRow[]
  responseAggregationType?: string
}

export interface GscUrlInspectionResult {
  inspectionResult: {
    indexStatusResult?: {
      coverageState?: string
      lastCrawlTime?: string
      pageFetchState?: string
      robotsTxtState?: string
      indexingState?: string
      verdict?: string
    }
  }
}

export type GscDimension = 'query' | 'page' | 'country' | 'device' | 'date'

export class GscProvider extends BaseProvider {
  readonly id: AIProviderId = 'gsc'
  readonly name = 'Google Search Console'
  override timeoutMs = 60000

  private get accessToken(): string | undefined {
    return process.env.GSC_ACCESS_TOKEN
  }

  private get refreshToken(): string | undefined {
    return process.env.GSC_REFRESH_TOKEN
  }

  private get baseUrl(): string {
    return 'https://www.googleapis.com/webmasters/v3'
  }

  isConfigured(): boolean {
    return !!this.accessToken || !!process.env.GSC_SERVICE_ACCOUNT_KEY
  }

  protected async healthCheckRequest(): Promise<Response> {
    return fetch(`${this.baseUrl}/sites`, {
      method: 'GET',
      headers: await this.authHeaders(),
      signal: AbortSignal.timeout(10000),
    })
  }

  protected async executeRequest(request: AIProviderRequest): Promise<Response> {
    const siteUrl = (request as any).siteUrl || process.env.GSC_SITE_URL
    if (!siteUrl) {
      throw new Error('GSC siteUrl not configured')
    }

    const params = (request as any).gscParams as GscQueryParams | undefined
    if (!params) {
      throw new Error('GSC query params required')
    }

    return this.searchRaw(siteUrl, params)
  }

  protected transformResponse(data: unknown): AIProviderResult {
    const rows = (data as GscApiResponse).rows || []
    return {
      success: true,
      provider: this.id,
      text: JSON.stringify(rows),
      latencyMs: 0,
      tokensUsed: rows.length,
      costEstimate: 0,
    }
  }

  async search(siteUrl: string, params: GscQueryParams): Promise<GscRow[]> {
    const response = await this.searchRaw(siteUrl, params)
    if (!response.ok) {
      throw new Error(`GSC API error ${response.status}: ${await response.text()}`)
    }
    const data = (await response.json()) as GscApiResponse
    return data.rows || []
  }

  private async searchRaw(siteUrl: string, params: GscQueryParams): Promise<Response> {
    const body = {
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: params.dimensions || ['query'],
      rowLimit: params.rowLimit || 25000,
      startRow: 0,
      searchType: params.searchType || 'web',
      aggregationType: 'byProperty',
    }

    return fetch(`${this.baseUrl}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
      method: 'POST',
      headers: await this.authHeaders(),
      body: JSON.stringify(body),
    })
  }

  async getTopQueries(
    siteUrl: string,
    startDate: string,
    endDate: string,
    limit = 100,
  ): Promise<GscRow[]> {
    return this.search(siteUrl, {
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit: limit,
    })
  }

  async getTopPages(
    siteUrl: string,
    startDate: string,
    endDate: string,
    limit = 100,
  ): Promise<GscRow[]> {
    return this.search(siteUrl, {
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit: limit,
    })
  }

  async getQueryPageMatrix(
    siteUrl: string,
    startDate: string,
    endDate: string,
    limit = 5000,
  ): Promise<GscRow[]> {
    return this.search(siteUrl, {
      startDate,
      endDate,
      dimensions: ['query', 'page'],
      rowLimit: limit,
    })
  }

  async getCountryBreakdown(
    siteUrl: string,
    startDate: string,
    endDate: string,
  ): Promise<GscRow[]> {
    return this.search(siteUrl, {
      startDate,
      endDate,
      dimensions: ['country'],
    })
  }

  async getDeviceBreakdown(siteUrl: string, startDate: string, endDate: string): Promise<GscRow[]> {
    return this.search(siteUrl, {
      startDate,
      endDate,
      dimensions: ['device'],
    })
  }

  async getDailyTrend(siteUrl: string, startDate: string, endDate: string): Promise<GscRow[]> {
    return this.search(siteUrl, {
      startDate,
      endDate,
      dimensions: ['date'],
    })
  }

  async inspectUrl(siteUrl: string, url: string): Promise<GscUrlInspectionResult> {
    const response = await fetch(
      `${this.baseUrl}/sites/${encodeURIComponent(siteUrl)}/urlInspection`,
      {
        method: 'POST',
        headers: await this.authHeaders(),
        body: JSON.stringify({
          inspectionUrl: url,
          siteUrl,
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`GSC URL inspection error ${response.status}: ${await response.text()}`)
    }

    return response.json() as Promise<GscUrlInspectionResult>
  }

  async getSitemapList(
    siteUrl: string,
  ): Promise<{ sitemap: string; path: string; lastSubmitted: string; errors: number }[]> {
    const response = await fetch(`${this.baseUrl}/sites/${encodeURIComponent(siteUrl)}/sitemaps`, {
      method: 'GET',
      headers: await this.authHeaders(),
    })

    if (!response.ok) {
      throw new Error(`GSC sitemaps error ${response.status}: ${await response.text()}`)
    }

    const data = (await response.json()) as {
      sitemap: Array<{ path: string; lastSubmitted: string; errors: number }>
    }
    return (data.sitemap || []).map((s) => ({
      sitemap: siteUrl,
      path: s.path,
      lastSubmitted: s.lastSubmitted,
      errors: s.errors,
    }))
  }

  private async authHeaders(): Promise<Record<string, string>> {
    if (this.accessToken) {
      return {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      }
    }

    const serviceAccountKey = process.env.GSC_SERVICE_ACCOUNT_KEY
    if (serviceAccountKey) {
      const key = JSON.parse(serviceAccountKey)
      const token = await this.getServiceAccountToken(key)
      return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    }

    throw new Error('GSC not configured: set GSC_ACCESS_TOKEN or GSC_SERVICE_ACCOUNT_KEY')
  }

  private async getServiceAccountToken(key: Record<string, string>): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    const jwtHeader = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString(
      'base64url',
    )
    const jwtPayload = Buffer.from(
      JSON.stringify({
        iss: key.client_email,
        scope: 'https://www.googleapis.com/auth/webmasters.readonly',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      }),
    ).toString('base64url')

    const privateKey = key.private_key
    if (!privateKey) {
      throw new Error('GSC service account private key missing')
    }

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      await crypto.subtle.importKey(
        'pkcs8',
        new TextEncoder().encode(privateKey),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign'],
      ),
      new TextEncoder().encode(`${jwtHeader}.${jwtPayload}`),
    )

    const jwt = `${jwtHeader}.${jwtPayload}.${Buffer.from(signature).toString('base64url')}`

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    })

    if (!tokenRes.ok) {
      throw new Error(`GSC token error: ${await tokenRes.text()}`)
    }

    const tokenData = (await tokenRes.json()) as { access_token: string }
    return tokenData.access_token
  }
}

let instance: GscProvider | null = null

export function getGscProvider(): GscProvider {
  if (!instance) {
    instance = new GscProvider()
  }
  return instance
}
