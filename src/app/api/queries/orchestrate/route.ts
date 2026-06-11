// PATH: src/app/api/queries/orchestrate/route.ts
// API endpoint for orchestrated multi-provider queries

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { asUntyped } from '@/lib/supabase-untyped'
import { queryOrchestrator } from '@/lib/services/query-orchestrator'
import { calculateOrchestratedCost } from '@/lib/services/cost-calculator'
import { verifyBrandAccess } from '@/lib/authorize'
import { firstZodMessage } from '@/lib/validations'
import { checkRateLimit } from '@/lib/ratelimit'
import type { MonitoringEngine } from '@/types'
import { logger } from '@/lib/logger'

const orchestrateBodySchema = z.object({
  prompt: z.string().min(1, 'prompt is required').max(10_000),
  brand_id: z.string().max(100).optional(),
  engines: z.array(z.string().max(40)).min(1).max(10).optional(),
  use_cache: z.boolean().optional(),
})

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// ─── POST /api/queries/orchestrate — Execute orchestrated query ────────────────
export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const { success } = await checkRateLimit(`user:${userId}:orchestrate`, 3, 60_000)
  if (!success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Max 3 requests per minute.' },
      { status: 429 },
    )
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const parsed = orchestrateBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return err(firstZodMessage(parsed.error), 400)
  }
  const {
    prompt,
    brand_id,
    engines = ['chatgpt', 'gemini', 'perplexity'],
    use_cache = true,
  } = parsed.data

  // Verify brand access if brand_id provided
  if (brand_id) {
    const brand = await verifyBrandAccess(brand_id, userId)
    if (!brand) {
      return err('Brand not found or access denied', 404)
    }
  }

  // Execute orchestrated query
  logger.info('Executing orchestrated query', { route: '/api/queries/orchestrate', engines })

  const result = await queryOrchestrator.orchestrateQuery(prompt, engines as MonitoringEngine[], {
    useCache: use_cache,
  })

  // Calculate cost
  const costSummary = calculateOrchestratedCost(
    result.responses
      .filter((r) => r.success)
      .map((r) => ({
        provider: r.provider,
        content: r.content,
      })),
    result.totalTimeMs,
    result.failureCount,
  )

  // Save to database if brand_id provided
  let savedResult = null
  if (brand_id) {
    // SCHEMA DRIFT (TODO): the generated Database type marks prompt_id as
    // NOT NULL but this route inserts null for "direct queries with no
    // linked prompt". Either the DB column allows NULL (codegen lying) or
    // there's a missing migration. asUntyped() unblocks TS — runtime
    // behaviour preserved.
    const { data, error } = await asUntyped(db)
      .from('monitoring_results')
      .insert({
        prompt_id: null, // No linked prompt for direct queries
        brand_id,
        user_id: userId,
        engine: result.bestResponse.engine,
        prompt_text: prompt,
        response_text: result.bestResponse.content,
        cited_urls: result.bestResponse.citedUrls || [],
        brand_mentioned: result.bestResponse.mentionDetected,
        execution_time_ms: result.totalTimeMs,
        cost_credits: costSummary.estimatedCreditsNeeded,
        primary_provider: result.bestResponse.provider,
        all_providers: result.engines,
        failed_providers: result.responses.filter((r) => !r.success).map((r) => r.provider),
        response_comparison: result.responses.map((r) => ({
          provider: r.provider,
          engine: r.engine,
          success: r.success,
          response_time_ms: r.responseTimeMs,
          content_length: r.content.length,
          mention_detected: r.mentionDetected,
          cited_urls_count: r.citedUrls?.length || 0,
          error: r.error,
        })),
      })
      .select()
      .single()

    if (error) {
      logger.error('Failed to save orchestrated result', {
        route: '/api/queries/orchestrate',
        error,
      })
    } else {
      savedResult = data
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      request_id: result.requestId,
      prompt: prompt,
      engines: result.engines,
      best_response: {
        provider: result.bestResponse.provider,
        engine: result.bestResponse.engine,
        content: result.bestResponse.content,
        response_time_ms: result.bestResponse.responseTimeMs,
        mention_detected: result.bestResponse.mentionDetected,
        cited_urls: result.bestResponse.citedUrls,
      },
      all_responses: result.responses.map((r) => ({
        provider: r.provider,
        engine: r.engine,
        success: r.success,
        response_time_ms: r.responseTimeMs,
        mention_detected: r.mentionDetected,
        cited_urls_count: r.citedUrls?.length || 0,
        error: r.error,
      })),
      execution: {
        total_time_ms: result.totalTimeMs,
        success_count: result.successCount,
        failure_count: result.failureCount,
        cache_hit: !result.responses.every((r) => r.success), // If some failed, may be from cache
      },
      cost: costSummary,
      saved_result_id: savedResult?.id,
    },
    timestamp: Date.now(),
  })
}

// ─── GET /api/queries/orchestrate — Get cache stats ───────────────────────────
export async function GET(req: NextRequest) {
  const cacheStats = queryOrchestrator.getCacheStats()

  return NextResponse.json({
    success: true,
    data: {
      cache: {
        size: cacheStats.size,
        sample_keys: cacheStats.keys,
      },
      ttl_seconds: 3600,
    },
    timestamp: Date.now(),
  })
}
