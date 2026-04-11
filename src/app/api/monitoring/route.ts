// PATH: src/app/api/monitoring/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Json } from '@/types/database'
import { logger } from '@/lib/logger'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import {
  runMonitoringCheck,
  calculateHealthScore,
  calculateAVIFromResults,
} from '@/lib/services/monitoring'
import { shouldTriggerAlert, buildAlertEvent, dispatchAlert } from '@/lib/services/alerts'
import { checkRateLimit } from '@/lib/ratelimit'
import type { Brand, Prompt, MonitoringResult, AlertRule } from '@/types'

// ─── Validation ───────────────────────────────────────────────────────────────

const runSchema = z.object({
  prompt_id: z.string().uuid(),
  engines: z
    .array(z.enum(['chatgpt', 'gemini', 'perplexity']))
    .min(1)
    .max(3)
    .optional(),
})

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// ─── POST /api/monitoring ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const { success } = await checkRateLimit(`user:${userId}:monitoring`, 10, 60_000)
  if (!success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Max 10 requests per minute.' },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const parsed = runSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    )
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // ── Load prompt + brand ───────────────────────────────────────────────────
  // First just get the prompt by ID (don't filter by user_id yet)
  const { data: prompt, error: promptError } = await db
    .from('prompts')
    .select('*, brand:brands(*)')
    .eq('id', parsed.data.prompt_id)
    .single()

  if (promptError || !prompt) {
    return err('Prompt not found', 404)
  }

  // Now check access: either user owns the brand OR user owns the prompt
  const brand = prompt.brand as Brand

  // Convert to strings for comparison (user_id could be UUID or string)
  const brandOwnerId = String(brand.user_id ?? '')
  const promptOwnerId = String(prompt.user_id ?? '')
  const requestUserId = String(userId)

  const isBrandOwner = brandOwnerId === requestUserId
  const isPromptOwner = promptOwnerId === requestUserId

  // Also check team membership
  const { data: membership } = await db
    .from('team_members')
    .select('id')
    .eq('brand_id', brand.id)
    .eq('user_id', userId)
    .single()

  const isTeamMember = !!membership

  logger.debug('Access check', {
    source: 'monitoring',
    isBrandOwner,
    isPromptOwner,
    isTeamMember,
    promptUserId: promptOwnerId,
    brandUserId: brandOwnerId,
    requestUserId,
  })

  // Return 403 for access denied, not 404 (security best practice)
  if (!isBrandOwner && !isPromptOwner && !isTeamMember) {
    return NextResponse.json({ success: false, message: 'Access denied' }, { status: 403 })
  }

  // ── Resolve engines ───────────────────────────────────────────────────────
  const validEngines = ['chatgpt', 'gemini', 'perplexity', 'claude'] as const
  type Engine = (typeof validEngines)[number]

  const requestedEngines = parsed.data.engines ?? (prompt.engines as string[])
  const engines = requestedEngines.filter((e): e is Engine =>
    (validEngines as readonly string[]).includes(e),
  )

  if (engines.length === 0) {
    return err('No valid engines specified', 400)
  }

  // ── Check/deduct credits before running ───────────────────────────────────
  logger.debug('Checking credits for engines', { source: 'monitoring', engines })

  try {
    const creditRes = await fetch(new URL('/api/credits/use', req.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.get('authorization') || '',
        Cookie: req.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        engines,
        brand_id: brand.id,
        query_id: prompt.id,
      }),
    })

    const creditData = await creditRes.json()
    logger.debug('Credit check result', { source: 'monitoring', creditData })

    if (!creditData.success || !creditData.data?.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: creditData.message || 'Insufficient credits',
          error: 'INSUFFICIENT_CREDITS',
          data: {
            cost: creditData.data?.cost,
            balance: creditData.data?.balance,
          },
        },
        { status: 402 },
      )
    }

    logger.debug('Credits approved', { source: 'monitoring', data: creditData.data })
  } catch (creditErr) {
    logger.error('Credit check failed', { source: 'monitoring', error: String(creditErr) })
    // Continue anyway - credit check failure shouldn't block monitoring in dev mode
  }

  // ── Fetch previous results per change detection ───────────────────────────
  const { data: previousResults } = await db
    .from('monitoring_results')
    .select('*')
    .eq('prompt_id', prompt.id)
    .in('engine', engines)
    .order('created_at', { ascending: false })
    .limit(engines.length)

  // ── FIX N+1: fetch alert rules UNA VOLTA sola prima del loop ─────────────
  const { data: rules } = await db
    .from('alert_rules')
    .select('*')
    .eq('brand_id', brand.id)
    .eq('is_active', true)

  const results: MonitoringResult[] = []
  const errors: string[] = []

  // ── Run engines in parallel ───────────────────────────────────────────────
  logger.info('Starting engines', { source: 'monitoring', engines, promptId: prompt.id })

  await Promise.all(
    engines.map(async (engine) => {
      try {
        logger.debug('Running engine', { source: 'monitoring', engine, promptId: prompt.id })
        const resultData = await runMonitoringCheck(prompt as Prompt, brand, engine, userId)
        logger.debug('Engine completed', { source: 'monitoring', engine, resultPreview: JSON.stringify(resultData).slice(0, 500) })

        const truncatedData = {
          ...resultData,
          competitor_mentions: resultData.competitor_mentions as unknown as Json,
          hallucination_flags: resultData.hallucination_flags as unknown as Json,
          response_text:
            resultData.response_text.length > 5000
              ? resultData.response_text.slice(0, 5000) + '…'
              : resultData.response_text,
        }

        const { data: saved, error: insertError } = await db
          .from('monitoring_results')
          .insert(truncatedData)
          .select()
          .single()

        if (insertError || !saved) {
          logger.error('DB insert error', { source: 'monitoring', engine, error: JSON.stringify(insertError) })
          errors.push(`${engine}: DB insert failed - ${insertError?.message || 'Unknown error'}`)
          return
        }

        results.push(saved as unknown as MonitoringResult)

        // ── Evaluate alert rules (usa rules già fetchate) ───────────────────
        if (rules && rules.length > 0) {
          const previousResult = (previousResults as unknown as MonitoringResult[])?.find(
            (r) => r.engine === engine,
          )

          for (const rule of rules as AlertRule[]) {
            const shouldFire = shouldTriggerAlert(rule, {
              result: saved as unknown as MonitoringResult,
              previousResult,
              brand,
            })

            if (shouldFire) {
              const event = buildAlertEvent(rule, saved as unknown as MonitoringResult, brand)

              const { brand: _b, alert_rule: _ar, data: eventData, ...eventRest } = event
              const { data: savedEvent } = await db
                .from('alert_events')
                .insert({ ...eventRest, data: eventData as unknown as Json, user_id: userId })
                .select()
                .single()

              if (savedEvent) {
                // FIX: log errori dispatchAlert invece di ignorarli silenziosamente
                let channelsSent: string[] = []
                try {
                  channelsSent = await dispatchAlert(
                    savedEvent as Parameters<typeof dispatchAlert>[0],
                    rule,
                    brand,
                  )
                } catch (dispatchErr) {
                  logger.error('dispatchAlert failed', { source: 'monitoring', ruleId: rule.id, error: String(dispatchErr) })
                }

                await db
                  .from('alert_events')
                  .update({ channels_sent: channelsSent })
                  .eq('id', savedEvent.id)

                await db
                  .from('alert_rules')
                  .update({ last_fired_at: new Date().toISOString() })
                  .eq('id', rule.id)
              }
            }
          }
        }
      } catch (engineErr) {
        const msg = engineErr instanceof Error ? engineErr.message : String(engineErr)
        logger.error('Engine failed', { source: 'monitoring', engine, error: msg })
        errors.push(`${engine}: ${msg}`)
      }
    }),
  )

  logger.info('Monitoring complete', {
    source: 'monitoring',
    resultsCount: results.length,
    errorsCount: errors.length,
    errorDetails: errors,
  })

  // ── Update prompt last_run_at ─────────────────────────────────────────────
  await db
    .from('prompts')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', prompt.id)

  // ── Upsert daily brand health score ──────────────────────────────────────
  if (results.length > 0) {
    const { avi, components } = calculateAVIFromResults(results)
    const citedCount = results.filter((r) => r.cited_urls?.length > 0).length

    await db.from('brand_health_scores').upsert(
      {
        brand_id: brand.id,
        user_id: userId,
        date: new Date().toISOString().split('T')[0],
        visibility_score: components.mentionFrequency,
        sentiment_score: components.sentimentScore,
        hallucination_rate: components.hallucinationIndex / 100,
        mention_count: results.filter((r) => r.brand_mentioned).length,
        citation_count: citedCount,
        // AVI component fields
        avi_score: avi,
        citation_rate: components.citationRate,
        mention_rate: components.mentionFrequency,
        recommendation_rate: components.recommendationRate,
        position_avg: components.positionAvg,
        health_score: avi,
        engine_breakdown: JSON.stringify(
          Object.fromEntries(results.map((r) => [r.engine, r.visibility_score])),
        ),
      },
      { onConflict: 'brand_id,date' },
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      results,
      enginesRun: engines.length,
      enginesSucceeded: results.length,
      enginesFailed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    },
    message: `Monitoring complete: ${results.length}/${engines.length} engines succeeded`,
    timestamp: Date.now(),
  })
}

// ─── GET /api/monitoring ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { searchParams } = new URL(req.url)

  const brandId = searchParams.get('brand_id')
  const engine = searchParams.get('engine')
  const language = searchParams.get('language')
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50))
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const offset = (page - 1) * limit

  let query = db
    .from('monitoring_results')
    .select('*, prompt:prompts(text, category, language)', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (brandId) query = query.eq('brand_id', brandId)
  if (engine) query = query.eq('engine', engine)
  if (language) query = query.eq('prompt.language', language)

  const { data, error, count } = await query

  if (error) return err(error.message)

  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      perPage: limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / limit),
    },
    timestamp: Date.now(),
  })
}
