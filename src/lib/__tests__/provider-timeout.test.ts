import { describe, it, expect } from 'vitest'
import { BaseProvider } from '../providers/base-provider'
import type { AIProviderRequest, AIProviderResult } from '../providers/types'
import { DEFAULT_RETRY_CONFIG } from '../providers/retry'

// Regression guard for the OCR finding: BaseProvider created an AbortController
// but never passed `controller.signal` to executeRequest, so the per-request
// timeout never actually cancelled a hung fetch (the catch waited for an
// AbortError that could never fire). This provider hangs forever UNLESS the
// abort signal reaches executeRequest — so the test only passes when the wiring
// is correct, and fails fast (or times out) if it regresses.
class HangingProvider extends BaseProvider {
  readonly id = 'chatgpt' as const
  readonly name = 'Hanging Test Provider'
  public aborted = false

  constructor() {
    super()
    this.timeoutMs = 40
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, maxAttempts: 1 }
  }

  isConfigured(): boolean {
    return true
  }

  protected healthCheckRequest(): Promise<Response> {
    return Promise.resolve(new Response('ok'))
  }

  protected executeRequest(_request: AIProviderRequest, signal?: AbortSignal): Promise<Response> {
    return new Promise<Response>((_resolve, reject) => {
      if (!signal) {
        // Wiring regressed — fail loudly instead of hanging until the timeout.
        reject(new Error('executeRequest received no AbortSignal'))
        return
      }
      signal.addEventListener('abort', () => {
        this.aborted = true
        reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
      })
    })
  }

  protected transformResponse(): AIProviderResult {
    return { success: true, provider: this.id, text: 'unused', latencyMs: 0 }
  }
}

describe('BaseProvider request timeout', () => {
  it('passes the abort signal into executeRequest and cancels a hung request', async () => {
    const provider = new HangingProvider()
    const result = await provider.execute({ prompt: 'hello' })

    // The signal reached the request and fired → proves the wiring.
    expect(provider.aborted).toBe(true)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/timeout/i)
  })
})
