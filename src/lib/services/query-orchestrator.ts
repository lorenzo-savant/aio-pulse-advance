// PATH: src/lib/services/query-orchestrator.ts
// Query Orchestrator — executes multiple AI providers in parallel
//
// Features:
// - Parallel execution (not sequential)
// - Response caching (1 hour TTL)
// - Execution time tracking
// - Fallback system (handles partial failures)
// - Result aggregation from all providers

import type { Brand, MonitoringEngine } from '@/types'
import { logger } from '@/lib/logger'

interface QueryResponse {
  provider: string
  engine: string
  content: string
  responseTimeMs: number
  citedUrls?: string[]
  mentionDetected: boolean
  success: boolean
  error?: string
  retrieval?: 'live' | 'model-memory'
}

interface OrchestratedResult {
  requestId: string
  promptText: string
  engines: string[]
  responses: QueryResponse[]
  bestResponse: QueryResponse
  totalTimeMs: number
  successCount: number
  failureCount: number
  timestamp: Date
}

const CACHE_TTL_MS = 3600000 // 1 hour

class QueryOrchestrator {
  private responseCache = new Map<string, OrchestratedResult>()

  /**
   * Execute query on multiple providers in parallel
   */
  async orchestrateQuery(
    promptText: string,
    engines: MonitoringEngine[] = ['chatgpt', 'gemini', 'perplexity', 'claude'],
    options?: {
      cacheKey?: string
      useCache?: boolean
      brand?: Brand | null
    },
  ): Promise<OrchestratedResult> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    const cacheKey = options?.cacheKey || this.generateCacheKey(promptText, engines, options?.brand)
    const useCache = options?.useCache !== false

    // 1. Check cache
    if (useCache) {
      const cached = this.responseCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp.getTime() < CACHE_TTL_MS) {
        logger.debug('Cache hit', {
          service: 'query-orchestrator',
          cacheKey: cacheKey.slice(0, 40),
        })
        return cached
      }
    }

    // 2. Execute all providers in parallel
    logger.info('Executing providers in parallel', {
      service: 'query-orchestrator',
      providerCount: engines.length,
      engines,
    })
    const startTime = Date.now()

    const brand = options?.brand ?? null
    const promises = engines.map((engine) =>
      this.executeProvider(engine, promptText, requestId, brand),
    )

    const results = await Promise.allSettled(promises)

    // 3. Aggregate responses
    const responses: QueryResponse[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        logger.error('Provider failed', {
          service: 'query-orchestrator',
          provider: engines[index],
          error: result.reason,
        })
        return {
          provider: engines[index],
          engine: engines[index],
          content: '',
          responseTimeMs: 0,
          mentionDetected: false,
          success: false,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        } as QueryResponse
      }
    })

    const totalTimeMs = Date.now() - startTime
    const successCount = responses.filter((r) => r.success).length
    const failureCount = responses.filter((r) => !r.success).length

    // 4. Pick best response
    const successfulResponses = responses.filter((r) => r.success)
    let bestResponse: QueryResponse

    if (successfulResponses.length > 0) {
      bestResponse = this.selectBestResponse(successfulResponses)
    } else if (responses.length > 0) {
      bestResponse = responses[0]!
    } else {
      bestResponse = {
        provider: 'none',
        engine: engines[0] || 'chatgpt',
        content: '',
        responseTimeMs: totalTimeMs,
        mentionDetected: false,
        success: false,
        error: 'No responses received',
      }
    }

    const orchestratedResult: OrchestratedResult = {
      requestId,
      promptText,
      engines,
      responses,
      bestResponse,
      totalTimeMs,
      successCount,
      failureCount,
      timestamp: new Date(),
    }

    // 5. Cache result
    if (successCount > 0) {
      this.responseCache.set(cacheKey, orchestratedResult)
    }

    // 6. Log results
    logger.info('Orchestration complete', {
      service: 'query-orchestrator',
      successCount,
      totalEngines: engines.length,
      totalTimeMs,
    })

    return orchestratedResult
  }

  /**
   * Execute single provider
   */
  private async executeProvider(
    engine: MonitoringEngine,
    promptText: string,
    requestId: string,
    brand?: Brand | null,
  ): Promise<QueryResponse> {
    const startTime = Date.now()
    const providerName = this.getProviderName(engine)

    try {
      // Import and execute the engine simulation
      const { simulateEngineResponse } = await import('./ai-router')

      const result = await simulateEngineResponse(promptText, engine, 'en', brand)

      const responseTimeMs = Date.now() - startTime

      // Analyze response for brand mentions and citations
      const mentionDetected = this.detectBrandMentions(result.text)
      const citedUrls = this.extractUrls(result.text)

      return {
        provider: result.provider,
        engine,
        content: result.text,
        responseTimeMs,
        citedUrls,
        mentionDetected,
        success: true,
        retrieval: result.retrieval,
      }
    } catch (error) {
      const responseTimeMs = Date.now() - startTime
      logger.error('Provider execution failed', {
        service: 'query-orchestrator',
        provider: providerName,
        error,
      })

      return {
        provider: providerName,
        engine,
        content: '',
        responseTimeMs,
        mentionDetected: false,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Get provider display name
   */
  private getProviderName(engine: MonitoringEngine): string {
    const names: Record<MonitoringEngine, string> = {
      chatgpt: 'openai',
      gemini: 'gemini',
      perplexity: 'perplexity',
      claude: 'anthropic',
    }
    return names[engine] || engine
  }

  /**
   * Detect brand mentions in response text
   */
  private detectBrandMentions(text: string): boolean {
    const mentionPatterns = [
      /\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\b/g, // Capitalized words
      /\b(brand|product|service|company|platform|tool)\b/i,
    ]
    return mentionPatterns.some((pattern) => pattern.test(text))
  }

  /**
   * Extract URLs from response
   */
  private extractUrls(text: string): string[] {
    const urlPattern = /https?:\/\/[^\s\]\)>]+/g
    const matches = text.match(urlPattern)
    return matches ? [...new Set(matches)] : []
  }

  /**
   * Select best response based on multiple criteria
   */
  private selectBestResponse(responses: QueryResponse[]): QueryResponse {
    const scored = responses.map((r) => {
      let score = 0

      // Has content
      if (r.content.length > 50) score += 10

      // Has citations
      if (r.citedUrls && r.citedUrls.length > 0) score += r.citedUrls.length * 5

      // Has brand mentions
      if (r.mentionDetected) score += 20

      // Faster is better
      score += Math.max(0, 100 - r.responseTimeMs / 100)

      return { response: r, score }
    })

    return scored.reduce((best, current) => (current.score > best.score ? current : best)).response
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(
    prompt: string,
    engines: MonitoringEngine[],
    brand?: Brand | null,
  ): string {
    const normalized = prompt.toLowerCase().trim().slice(0, 100)
    const brandTag = brand ? `:brand=${brand.id}` : ''
    return `orch:${normalized}:${engines.sort().join(',')}${brandTag}`
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): number {
    const now = Date.now()
    let cleared = 0

    for (const [key, value] of this.responseCache.entries()) {
      if (now - value.timestamp.getTime() > CACHE_TTL_MS) {
        this.responseCache.delete(key)
        cleared++
      }
    }

    return cleared
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.responseCache.size,
      keys: Array.from(this.responseCache.keys()).slice(0, 10),
    }
  }
}

// Export singleton instance
export const queryOrchestrator = new QueryOrchestrator()

// Start periodic cache cleanup
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cleared = queryOrchestrator.clearExpiredCache()
    if (cleared > 0) {
      logger.debug('Cleared expired cache entries', { service: 'query-orchestrator', cleared })
    }
  }, 300000) // Every 5 minutes
}
