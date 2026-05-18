import { BaseProvider } from './base-provider'
import type { AIProviderId, AIProviderRequest, AIProviderResult } from './types'

export interface BrightDataScrapeRequest {
  datasetId: string
  url: string
  prompt: string
  geolocation?: string
}

export interface BrightDataScrapeResult {
  answer: string
  sources: string[]
  raw: unknown
  snapshotId?: string
}

export class BrightDataProvider extends BaseProvider {
  readonly id: AIProviderId = 'brightdata'
  readonly name = 'Bright Data AI Scraper'
  override timeoutMs = 120000

  private get apiKey(): string | undefined {
    return process.env.BRIGHT_DATA_API_KEY
  }

  private get baseUrl(): string {
    return 'https://api.brightdata.com'
  }

  isConfigured(): boolean {
    return !!this.apiKey
  }

  protected async healthCheckRequest(): Promise<Response> {
    return fetch(`${this.baseUrl}/datasets/v3/progress/test`, {
      method: 'GET',
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(10000),
    })
  }

  async scrape(request: BrightDataScrapeRequest): Promise<BrightDataScrapeResult> {
    const inputRecord = {
      url: request.url,
      prompt: request.prompt,
      index: 1,
      ...(request.geolocation ? { geolocation: request.geolocation } : {}),
    }

    const response = await fetch(
      `${this.baseUrl}/datasets/v3/scrape?dataset_id=${request.datasetId}&notify=false&include_errors=true&format=json`,
      {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({ input: [inputRecord] }),
      },
    )

    if (!response.ok) {
      throw new Error(`Bright Data scrape failed: ${response.status} ${response.statusText}`)
    }

    let payload: unknown
    const contentType = response.headers.get('content-type') || ''

    if (response.status === 202) {
      const pending = (await response.json()) as { snapshot_id: string }
      await this.monitorUntilReady(pending.snapshot_id)
      payload = await this.downloadSnapshot(pending.snapshot_id)
    } else if (contentType.includes('application/json')) {
      payload = await response.json()
    } else {
      throw new Error(`Unexpected response format: ${contentType}`)
    }

    return this.normalizeResult(payload)
  }

  protected async executeRequest(request: AIProviderRequest): Promise<Response> {
    throw new Error('Use scrape() method for Bright Data provider')
  }

  protected transformResponse(): AIProviderResult {
    throw new Error('Use scrape() method for Bright Data provider')
  }

  private authHeaders(): Record<string, string> {
    if (!this.apiKey) {
      throw new Error('BRIGHT_DATA_API_KEY not configured')
    }
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
  }

  private async monitorUntilReady(snapshotId: string): Promise<void> {
    const maxAttempts = 60
    const baseDelay = 2000
    const maxDelay = 10000

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await fetch(`${this.baseUrl}/datasets/v3/progress/${snapshotId}`, {
        method: 'GET',
        headers: this.authHeaders(),
      })

      if (!res.ok) throw new Error(`Monitor failed: ${res.status}`)

      const status = (await res.json()) as { status: string }

      if (status.status === 'ready') return
      if (status.status === 'failed') throw new Error('Snapshot failed')

      const delay = Math.min(baseDelay * Math.pow(2, Math.floor(attempt / 5)), maxDelay)
      await new Promise((r) => setTimeout(r, delay))
    }

    throw new Error(`Timeout waiting for snapshot ${snapshotId}`)
  }

  private async downloadSnapshot(snapshotId: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/datasets/v3/snapshot/${snapshotId}?format=json`, {
      method: 'GET',
      headers: this.authHeaders(),
    })

    if (!res.ok) throw new Error(`Download failed: ${res.status}`)
    return res.json()
  }

  private normalizeResult(payload: unknown): BrightDataScrapeResult {
    const rawFirst = Array.isArray(payload)
      ? (payload as Record<string, unknown>[])[0]
      : (payload as Record<string, unknown>)

    const record = (rawFirst ?? {}) as Record<string, unknown>

    const answer = this.extractAnswer(record)
    const sources = this.extractSources(answer, record)

    return {
      answer,
      sources,
      raw: payload,
      snapshotId: typeof record.snapshot_id === 'string' ? record.snapshot_id : undefined,
    }
  }

  private extractAnswer(record: Record<string, unknown>): string {
    const candidates = [
      record.answer_text,
      record.answer_text_markdown,
      record.answer,
      record.response_raw,
      record.response,
      record.output,
      record.result,
      record.text,
      record.content,
    ]

    for (const item of candidates) {
      if (typeof item === 'string' && item.trim()) return item.trim()
    }

    return JSON.stringify(record).slice(0, 2000)
  }

  private extractSources(answer: string, record: Record<string, unknown>): string[] {
    const found = new Set<string>()

    const blockedHosts = [
      'chatgpt.com',
      'openai.com',
      'perplexity.ai',
      'copilot.microsoft.com',
      'grok.com',
      'x.ai',
      'gemini.google.com',
      'google.com',
      'cloudfront.net',
      'cdn.jsdelivr.net',
      'cdnjs.cloudflare.com',
    ]

    const urls = answer.match(/https?:\/\/[^\s)\]}"']+/g) ?? []
    for (const url of urls) {
      const cleaned = url.replace(/[),.;:!?]+$/, '')
      try {
        const parsed = new URL(cleaned)
        const host = parsed.hostname.toLowerCase()
        if (!blockedHosts.some((h) => host === h || host.endsWith(`.${h}`))) {
          parsed.hash = ''
          found.add(parsed.toString())
        }
      } catch {
        /* skip invalid URLs */
      }
    }

    for (const field of ['citations', 'links_attached', 'sources']) {
      const arr = record[field]
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (typeof item === 'string' && item.startsWith('http')) {
            found.add(item)
          } else if (item && typeof item === 'object') {
            const url = (item as Record<string, unknown>).url
            if (typeof url === 'string' && url.startsWith('http')) {
              found.add(url)
            }
          }
        }
      }
    }

    return [...found]
  }
}

let instance: BrightDataProvider | null = null

export function getBrightDataProvider(): BrightDataProvider {
  if (!instance) {
    instance = new BrightDataProvider()
  }
  return instance
}
