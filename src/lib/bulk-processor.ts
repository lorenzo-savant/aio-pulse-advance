import { getProviderManager, type AIProviderId } from '@/lib/providers'
import type { AIProviderRequest, AIProviderResult } from '@/lib/providers'

export interface BulkQueryResult {
  queryId: string
  prompt: string
  provider: AIProviderId
  result: AIProviderResult
  processedAt: string
}

export interface BulkQueryOptions {
  delayMs?: number
  onProgress?: (completed: number, total: number) => void
  onQueryComplete?: (queryId: string, result: AIProviderResult) => void
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function processBulkQueries(
  queries: Array<{ id: string; prompt: string; provider?: AIProviderId }>,
  options: BulkQueryOptions = {},
): Promise<BulkQueryResult[]> {
  const manager = getProviderManager()
  const results: BulkQueryResult[] = []
  const delayMs = options.delayMs ?? 1000

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i]!

    try {
      const request: AIProviderRequest = { prompt: query.prompt }

      let result: AIProviderResult
      if (query.provider) {
        result = await manager.executeWithProvider(request, query.provider)
      } else {
        result = await manager.executeWithFallback(request)
      }

      const bulkResult: BulkQueryResult = {
        queryId: query.id,
        prompt: query.prompt,
        provider: result.provider,
        result,
        processedAt: new Date().toISOString(),
      }

      results.push(bulkResult)

      if (options.onQueryComplete) {
        options.onQueryComplete(query.id, result)
      }

      if (options.onProgress) {
        options.onProgress(i + 1, queries.length)
      }

      if (i < queries.length - 1 && delayMs > 0) {
        await sleep(delayMs)
      }
    } catch (err) {
      const errorResult: AIProviderResult = {
        success: false,
        provider: query.provider || 'gemini',
        error: err instanceof Error ? err.message : 'Unknown error',
      }

      results.push({
        queryId: query.id,
        prompt: query.prompt,
        provider: query.provider || 'gemini',
        result: errorResult,
        processedAt: new Date().toISOString(),
      })

      if (options.onProgress) {
        options.onProgress(i + 1, queries.length)
      }
    }
  }

  return results
}

export async function processBulkQueriesParallel(
  queries: Array<{ id: string; prompt: string; provider?: AIProviderId }>,
  concurrency: number = 3,
  delayMs: number = 1000,
): Promise<BulkQueryResult[]> {
  const manager = getProviderManager()
  const results: BulkQueryResult[] = new Array(queries.length)
  let currentIndex = 0

  const processNext = async (): Promise<void> => {
    while (true) {
      const myIndex = currentIndex++
      if (myIndex >= queries.length) break

      const query = queries[myIndex]!
      const request: AIProviderRequest = { prompt: query.prompt }

      try {
        let result: AIProviderResult
        if (query.provider) {
          result = await manager.executeWithProvider(request, query.provider)
        } else {
          result = await manager.executeWithFallback(request)
        }

        results[myIndex] = {
          queryId: query.id,
          prompt: query.prompt,
          provider: result.provider,
          result,
          processedAt: new Date().toISOString(),
        }
      } catch (err) {
        results[myIndex] = {
          queryId: query.id,
          prompt: query.prompt,
          provider: query.provider || 'gemini',
          result: {
            success: false,
            provider: query.provider || 'gemini',
            error: err instanceof Error ? err.message : 'Unknown error',
          },
          processedAt: new Date().toISOString(),
        }
      }

      if (delayMs > 0) {
        await sleep(delayMs)
      }
    }
  }

  const workers = Array(Math.min(concurrency, queries.length))
    .fill(null)
    .map(() => processNext())

  await Promise.all(workers)

  return results.filter((r): r is BulkQueryResult => r !== undefined)
}

export function getBulkQueryStats(results: BulkQueryResult[]): {
  total: number
  successful: number
  failed: number
  byProvider: Record<string, number>
  averageLatencyMs: number
} {
  const successful = results.filter((r) => r.result.success).length
  const failed = results.length - successful

  const byProvider: Record<string, number> = {}
  let totalLatency = 0
  let latencyCount = 0

  for (const r of results) {
    byProvider[r.provider] = (byProvider[r.provider] || 0) + 1
    if (r.result.latencyMs) {
      totalLatency += r.result.latencyMs
      latencyCount++
    }
  }

  return {
    total: results.length,
    successful,
    failed,
    byProvider,
    averageLatencyMs: latencyCount > 0 ? totalLatency / latencyCount : 0,
  }
}
