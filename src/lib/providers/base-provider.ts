import type { AIProviderId, AIProviderRequest, AIProviderResult } from './types'
import {
  DEFAULT_RETRY_CONFIG,
  calculateRetryDelay,
  sleep,
  isRetryableError,
  type RetryConfig,
} from './retry'
import { recordProviderOutcome } from './credit-state'

export abstract class BaseProvider {
  abstract readonly id: AIProviderId
  abstract readonly name: string

  /**
   * The model this provider calls when the caller does not name one.
   *
   * Surfaced so the UI can state which model produced a measurement instead of
   * carrying its own copy. The Engine Info page used to hardcode display
   * strings and three of the four had drifted: it claimed "Gemini 1.5 Pro"
   * while the code called gemini-2.5-flash, and "Claude 3.5 Sonnet" while the
   * code called claude-sonnet-4-6. On a product whose job is reporting what AI
   * engines say about a brand, naming a model you did not query is a false
   * statement about the measurement itself.
   *
   * Empty for providers that are not answer engines (SERP, analytics).
   */
  readonly defaultModel: string = ''
  protected retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
  protected timeoutMs: number = 30000

  abstract isConfigured(): boolean

  protected abstract healthCheckRequest(): Promise<Response>

  protected abstract executeRequest(
    request: AIProviderRequest,
    signal?: AbortSignal,
  ): Promise<Response>

  protected abstract transformResponse(data: unknown): AIProviderResult

  async isAvailable(): Promise<boolean> {
    if (!this.isConfigured()) return false
    try {
      const response = await this.healthCheckRequest()
      return response.ok
    } catch {
      return false
    }
  }

  async execute(request: AIProviderRequest): Promise<AIProviderResult> {
    const startTime = Date.now()
    let lastError: string | undefined
    let lastStatusCode: number | undefined

    for (let attempt = 0; attempt < this.retryConfig.maxAttempts; attempt++) {
      try {
        const result = await this.executeWithTimeout(request, startTime)

        if (result.success) {
          // A request that went through is the only reliable proof that the
          // account can transact, so it clears any recorded billing failure.
          recordProviderOutcome(this.id, { success: true })
          return result
        }

        lastError = result.error
        lastStatusCode = result.statusCode

        if (result.statusCode && !isRetryableError(result.statusCode, this.retryConfig)) {
          // Terminal failure. A billing error takes this path — it is not
          // worth retrying an empty balance — so this is where credit
          // exhaustion is observed, not the exhausted-retries return below.
          recordProviderOutcome(this.id, result)
          return result
        }

        if (attempt < this.retryConfig.maxAttempts - 1) {
          const delay = calculateRetryDelay(attempt, this.retryConfig)
          await sleep(delay)
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Unknown error'

        if (attempt < this.retryConfig.maxAttempts - 1) {
          const delay = calculateRetryDelay(attempt, this.retryConfig)
          await sleep(delay)
        }
      }
    }

    // Retries exhausted. `lastStatusCode` used to be collected here and never
    // read; it now travels with the result so callers can tell a rate limit
    // from a server error, and so the credit classifier gets a last look at a
    // failure that only became terminal after retrying.
    const exhausted: AIProviderResult = {
      success: false,
      provider: this.id,
      error: `Failed after ${this.retryConfig.maxAttempts} attempts. Last error: ${lastError}`,
      latencyMs: Date.now() - startTime,
      ...(lastStatusCode != null ? { statusCode: lastStatusCode } : {}),
    }
    recordProviderOutcome(this.id, exhausted)
    return exhausted
  }

  private async executeWithTimeout(
    request: AIProviderRequest,
    startTime: number,
  ): Promise<AIProviderResult & { statusCode?: number }> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await this.executeRequest(request, controller.signal)
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read error body')
        const truncatedError = errorBody.slice(0, 500)
        return {
          success: false,
          provider: this.id,
          error: `API error ${response.status}: ${truncatedError}`,
          statusCode: response.status,
          latencyMs: Date.now() - startTime,
        }
      }

      const data = await response.json()
      return this.transformResponse(data)
    } catch (err) {
      clearTimeout(timeoutId)

      if (err instanceof Error && err.name === 'AbortError') {
        return {
          success: false,
          provider: this.id,
          error: `Request timeout after ${this.timeoutMs}ms`,
          statusCode: 408,
          latencyMs: this.timeoutMs,
        }
      }

      throw err
    }
  }

  protected calculateConfidence(latencyMs: number, baseConfidence: number = 0.8): number {
    const responseTimePenalty = Math.min(latencyMs / 10000, 0.2)
    return Math.max(0, baseConfidence - responseTimePenalty)
  }

  protected estimateCost(tokens: number, ratePerToken: number): number {
    return tokens * ratePerToken
  }
}
