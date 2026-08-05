// PATH: src/app/api/monitoring/route.ts
import { formatValidationError } from '@/lib/format-validation-error'
import { type NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import type { Json } from '@/types/database'
import { logger } from '@/lib/logger'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { runMonitoringCheck, calculateAVIFromResults } from '@/lib/services/monitoring'
import { shouldTriggerAlert, buildAlertEvent, dispatchAlert } from '@/lib/services/alerts'
import { calculateCitationSnapshots } from '@/lib/services/citation-snapshots'
import { trackKeywords } from '@/lib/services/keyword-tracker'
import { checkRateLimit } from '@/lib/ratelimit'
import { consumeCreditsForQuery } from '@/lib/services/credits'
import { getAccessibleBrandIds, requireBrandRole } from '@/lib/authorize'
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
        message: formatValidationError(parsed.error),
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

  const brand = prompt.brand as Brand

  // Running a prompt writes results into the brand and spends its credits, so
  // it takes editor rights on the brand — a viewer may read the results but not
  // produce more. The previous check also admitted the prompt's AUTHOR
  // regardless of brand access, which stopped making sense once prompts became
  // brand-scoped: authorship is provenance, not permission.
  const gate = await requireBrandRole(String(brand.id), userId, 'editor')
  if ('response' in gate) return gate.response

  // One project, one budget: the brand owner pays, whoever presses the button.
  // Billing the caller instead would leave a collaborator with an empty balance
  // unable to run the very analyses they were invited to run, and would scatter
  // one brand's spend across every account that touched it.
  const billingUserId = String(brand.user_id ?? '')

  logger.debug('Access check', {
    source: 'monitoring',
    role: gate.role,
    brandId: String(brand.id),
    billingUserId,
  })

  // ── Resolve engines ───────────────────────────────────────────────────────
  const validEngines = ['chatgpt', 'gemini', 'perplexity', 'claude'] as const
  type Engine = (typeof validEngines)[number]

  const promptEngines = Array.isArray(prompt.engines) ? (prompt.engines as string[]) : []
  const requestedEngines = parsed.data.engines ?? promptEngines
  let engines = requestedEngines.filter((e): e is Engine =>
    (validEngines as readonly string[]).includes(e),
  )

  // If the prompt has no engines set (legacy seed or manual insert), default
  // to all 4 core engines rather than rejecting the request.
  if (engines.length === 0) {
    engines = [...validEngines]
  }

  // ── Check/deduct credits before running ───────────────────────────────────
  logger.debug('Checking credits for engines', { source: 'monitoring', engines })

  try {
    // Direct service call. This used to be a self-HTTP fetch to
    // /api/credits/use that forwarded the caller's cookie/authorization and
    // derived the origin from the inbound Host header — double invocation,
    // second rate-limit token, and a header-forwarding hazard.
    const creditDecision = await consumeCreditsForQuery(billingUserId, {
      engines,
      brandId: brand.id,
      queryId: prompt.id,
    })
    logger.debug('Credit check result', { source: 'monitoring', creditDecision })

    if (!creditDecision.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: creditDecision.message || 'Insufficient credits',
          error: 'INSUFFICIENT_CREDITS',
          data: {
            cost: creditDecision.cost,
          },
        },
        { status: 402 },
      )
    }

    logger.debug('Credits approved', { source: 'monitoring', data: creditDecision })
  } catch (creditErr) {
    logger.error('Credit check failed', { source: 'monitoring', error: String(creditErr) })
    // Fail closed: never run paid LLM work if the credit gate could not be
    // evaluated. Only bypass when an explicit dev flag is set.
    if (process.env.ALLOW_CREDIT_BYPASS !== 'true') {
      return NextResponse.json(
        {
          success: false,
          message: 'Credit verification unavailable',
          error: 'CREDIT_CHECK_FAILED',
        },
        { status: 503 },
      )
    }
    logger.warn('Credit check bypassed via ALLOW_CREDIT_BYPASS', { source: 'monitoring' })
  }

  // ── Fetch previous results per change detection ───────────────────────────
  const { data: previousResults } = await db
    .from('monitoring_results')
    .select('*')
    .eq('prompt_id', prompt.id)
    .in('engine', engines)
    .order('created_at', { ascending: false })
    .limit(engines.length)

  // ── FIX N+1: fetch alert rules ONCE before the loop ─────────────────────
  const { data: rules } = await db
    .from('alert_rules')
    .select('*')
    .eq('brand_id', brand.id)
    .eq('is_active', true)

  const results: MonitoringResult[] = []
  const errors: string[] = []

  // ── Create workflow_execution row to track this run ──────────────────────
  const workflowId = randomUUID()
  const workflowStartedAt = new Date().toISOString()
  const workflowSteps = [
    {
      id: randomUUID(),
      name: 'Fetch prompt',
      status: 'completed',
      startedAt: workflowStartedAt,
      completedAt: workflowStartedAt,
    },
    { id: randomUUID(), name: 'Run engines', status: 'running', startedAt: workflowStartedAt },
    { id: randomUUID(), name: 'Save results', status: 'pending', startedAt: workflowStartedAt },
    {
      id: randomUUID(),
      name: 'Update health score',
      status: 'pending',
      startedAt: workflowStartedAt,
    },
  ]
  const { error: workflowErr } = await db.from('workflow_executions').insert({
    id: workflowId,
    type: 'monitoring_run',
    brand_id: brand.id,
    prompt_id: prompt.id,
    user_id: userId,
    status: 'running',
    steps: workflowSteps as unknown as Json,
    metadata: { engines, promptText: (prompt as Prompt).text } as unknown as Json,
    started_at: workflowStartedAt,
  })
  if (workflowErr) {
    logger.error('Workflow insert failed', { source: 'monitoring', error: String(workflowErr) })
  }

  // ── Run engines in parallel ───────────────────────────────────────────────
  logger.info('Starting engines', { source: 'monitoring', engines, promptId: prompt.id })

  await Promise.all(
    engines.map(async (engine) => {
      try {
        logger.debug('Running engine', { source: 'monitoring', engine, promptId: prompt.id })
        const resultData = await runMonitoringCheck(prompt as Prompt, brand, engine, userId)
        logger.debug('Engine completed', {
          source: 'monitoring',
          engine,
          resultPreview: JSON.stringify(resultData).slice(0, 500),
        })

        const truncatedData = {
          ...resultData,
          competitor_mentions: resultData.competitor_mentions as unknown as Json,
          hallucination_flags: resultData.hallucination_flags as unknown as Json,
          sentiment_aspects: resultData.sentiment_aspects as unknown as Json,
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
          logger.error('DB insert error', {
            source: 'monitoring',
            engine,
            error: JSON.stringify(insertError),
          })
          errors.push(`${engine}: DB insert failed - ${insertError?.message || 'Unknown error'}`)
          return
        }

        results.push(saved as unknown as MonitoringResult)

        // ── Evaluate alert rules (use already-fetched rules) ────────────────
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
                  logger.error('dispatchAlert failed', {
                    source: 'monitoring',
                    ruleId: rule.id,
                    error: String(dispatchErr),
                  })
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
  await db.from('prompts').update({ last_run_at: new Date().toISOString() }).eq('id', prompt.id)

  // ── Upsert daily brand health score ──────────────────────────────────────
  if (results.length > 0) {
    const { avi, components } = calculateAVIFromResults(results)
    const citedCount = results.filter((r) => r.cited_urls?.length > 0).length

    await db.from('brand_health_scores').upsert(
      {
        brand_id: brand.id,
        user_id: userId,
        date: new Date().toISOString().split('T')[0]!,
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

    // ── Auto-generate citation snapshots for today ─────────────────────────
    try {
      const snapshotResult = await calculateCitationSnapshots(brand.id)
      logger.debug('Citation snapshots generated', {
        source: 'monitoring',
        brandId: brand.id,
        inserted: snapshotResult.inserted,
        errors: snapshotResult.errors,
      })
    } catch (snapErr) {
      logger.error('Citation snapshots failed', {
        source: 'monitoring',
        error: String(snapErr),
      })
    }

    // ── Auto-track keywords from latest responses ──────────────────────────
    try {
      await trackKeywords(brand.id)
    } catch (kwErr) {
      logger.error('Keyword tracking failed', {
        source: 'monitoring',
        error: String(kwErr),
      })
    }
  }

  // ── Finalise workflow ────────────────────────────────────────────────────
  const workflowCompletedAt = new Date().toISOString()
  const finalStatus: 'completed' | 'failed' =
    results.length > 0 && errors.length === 0
      ? 'completed'
      : results.length === 0
        ? 'failed'
        : 'completed'
  const finalSteps = workflowSteps.map((s) =>
    s.status === 'running' || s.status === 'pending'
      ? { ...s, status: finalStatus, completedAt: workflowCompletedAt }
      : s,
  )
  await db
    .from('workflow_executions')
    .update({
      status: finalStatus,
      steps: finalSteps as unknown as Json,
      completed_at: workflowCompletedAt,
      error: errors.length > 0 ? errors.join('; ') : null,
    })
    .eq('id', workflowId)

  return NextResponse.json({
    success: true,
    data: {
      results,
      enginesRun: engines.length,
      enginesSucceeded: results.length,
      enginesFailed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      workflowId,
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

  // Every brand the caller can read, owned or collaborated on. Restricting this
  // to OWNED brands is what left an invited colleague with a visible brand and
  // no results inside it.
  const accessibleBrandIds = await getAccessibleBrandIds(db, userId)
  if (accessibleBrandIds.length === 0) {
    return NextResponse.json({
      success: true,
      data: [],
      pagination: { page, perPage: limit, total: 0, totalPages: 0 },
      timestamp: Date.now(),
    })
  }
  // An explicit brand_id the caller cannot reach is refused, not quietly
  // widened to "everything you can see". Widening answered a question nobody
  // asked and made a permission problem look like data — the same request
  // returns 404 from /api/alerts and /api/prompts.
  if (brandId && !accessibleBrandIds.includes(brandId)) {
    return err('Brand not found or access denied', 404)
  }
  const filterIds = brandId ? [brandId] : accessibleBrandIds

  let query = db
    .from('monitoring_results')
    .select('*, prompt:prompts(text, category, language)', { count: 'exact' })
    .in('brand_id', filterIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
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
