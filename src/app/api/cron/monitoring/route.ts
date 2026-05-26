// PATH: src/app/api/cron/monitoring/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import type { Json } from '@/types/database'
import { createServerClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'
import { runMonitoringCheck, calculateAVIFromResults } from '@/lib/services/monitoring'
import { shouldTriggerAlert, buildAlertEvent, dispatchAlert } from '@/lib/services/alerts'
import type {
  Brand,
  Prompt,
  MonitoringResult,
  MonitoringEngine,
  WorkflowStatus,
  AlertRule,
} from '@/types'
import { calculateCitationSnapshots } from '@/lib/services/citation-snapshots'

interface WorkflowStep {
  id: string
  name: string
  status: WorkflowStatus
  startedAt?: string
  completedAt?: string
  error?: string
}

interface CreateWorkflowResult {
  workflowId: string
  stepIds: string[]
}

async function createWorkflow(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  brandId: string,
  promptId: string,
  userId: string,
  engineCount: number,
): Promise<CreateWorkflowResult | null> {
  const workflowId = randomUUID()
  const now = new Date().toISOString()

  const steps: WorkflowStep[] = [
    {
      id: randomUUID(),
      name: 'Fetch prompts',
      status: 'completed',
      startedAt: now,
      completedAt: now,
    },
    { id: randomUUID(), name: 'Execute monitoring', status: 'running', startedAt: now },
    { id: randomUUID(), name: 'Save results', status: 'pending', startedAt: now },
    { id: randomUUID(), name: 'Update health scores', status: 'pending', startedAt: now },
    { id: randomUUID(), name: 'Calculate citation snapshots', status: 'pending', startedAt: now },
  ]

  const { error } = await supabase.from('workflow_executions').insert({
    id: workflowId,
    type: 'monitoring_run',
    brand_id: brandId,
    prompt_id: promptId,
    user_id: userId,
    status: 'running',
    steps: steps as unknown as Json,
    started_at: now,
  })

  if (error) {
    logger.error('Failed to create workflow', { source: 'cron', error: String(error) })
    return null
  }

  return { workflowId, stepIds: steps.map((s) => s.id) }
}

async function updateWorkflowStep(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  workflowId: string,
  stepName: string,
  status: WorkflowStatus,
  error?: string,
): Promise<void> {
  const { data } = await supabase
    .from('workflow_executions')
    .select('steps')
    .eq('id', workflowId)
    .single()

  if (!data) return

  const steps = (data.steps || []) as unknown as WorkflowStep[]
  const stepIndex = steps.findIndex((s) => s.name === stepName)
  if (stepIndex === -1) return

  const existingStep = steps[stepIndex]
  if (!existingStep) return

  steps[stepIndex] = {
    id: existingStep.id,
    name: existingStep.name,
    status,
    startedAt: existingStep.startedAt,
    completedAt: ['completed', 'failed'].includes(status) ? new Date().toISOString() : undefined,
    error,
  }

  const overallStatus: WorkflowStatus = steps.every((s) => s.status === 'completed')
    ? 'completed'
    : steps.some((s) => s.status === 'failed')
      ? 'failed'
      : steps.some((s) => s.status === 'running')
        ? 'running'
        : 'pending'

  const { error: updateError } = await supabase
    .from('workflow_executions')
    .update({
      steps: steps as unknown as Json,
      status: overallStatus,
      completed_at:
        overallStatus === 'completed' || overallStatus === 'failed'
          ? new Date().toISOString()
          : null,
      error: overallStatus === 'failed' ? error : null,
    })
    .eq('id', workflowId)

  if (updateError) {
    logger.error('Failed to update workflow step', {
      source: 'cron',
      stepName,
      error: String(updateError),
    })
  }
}

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min (Vercel Pro) or 60s (Hobby)

export async function POST(req: NextRequest) {
  const cronError = verifyCronAuth(req)
  if (cronError) return cronError

  const supabase = createServerClient()
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  try {
    // ── Fetch prompts due for execution ───────────────────────────────────────
    const now = new Date()

    // Build frequency thresholds
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Fetch prompts that haven't run recently enough, with their brand
    const { data: prompts, error: promptsError } = await supabase
      .from('prompts')
      .select('*, brand:brands(*)')
      .eq('is_active', true)
      .or(
        `last_run_at.is.null,and(run_frequency.eq.hourly,last_run_at.lte.${oneHourAgo}),and(run_frequency.eq.daily,last_run_at.lte.${oneDayAgo}),and(run_frequency.eq.weekly,last_run_at.lte.${oneWeekAgo})`,
      )
      .limit(3) // Process max 10 prompts per cron run to stay within timeout

    if (promptsError) {
      logger.error('Error fetching prompts', { source: 'cron', error: String(promptsError) })
      return NextResponse.json(
        { success: false, message: 'Failed to fetch prompts' },
        { status: 500 },
      )
    }

    if (!prompts || prompts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No prompts due for execution',
        results: [],
      })
    }

    const results: Array<{ promptId: string; engine: string; success: boolean; error?: string }> =
      []

    const processedBrands = new Set<string>()

    for (const promptRow of prompts) {
      const brand = promptRow.brand as unknown as Brand
      if (!brand || !brand.is_active) continue

      const prompt = promptRow as unknown as Prompt
      const validEngines = ['chatgpt', 'gemini', 'perplexity', 'claude'] as const
      const engines = (prompt.engines || ['chatgpt', 'gemini', 'perplexity', 'claude']).filter(
        (e): e is MonitoringEngine => (validEngines as readonly string[]).includes(e),
      )

      const workflowResult = await createWorkflow(
        supabase,
        brand.id,
        prompt.id,
        prompt.user_id,
        engines.length,
      )
      const workflowId = workflowResult?.workflowId

      const engineResults: MonitoringResult[] = []
      let hasErrors = false

      // Change-detection inputs: previous results per engine + active alert
      // rules. Scheduled runs must fire alerts (sentiment_drop, mention_lost,
      // …) just like manual runs do.
      const { data: previousResults } = await supabase
        .from('monitoring_results')
        .select('*')
        .eq('prompt_id', prompt.id)
        .in('engine', engines)
        .order('created_at', { ascending: false })
        .limit(engines.length)

      const { data: alertRules } = await supabase
        .from('alert_rules')
        .select('*')
        .eq('brand_id', brand.id)
        .eq('is_active', true)

      for (const engine of engines) {
        try {
          await new Promise((r) => setTimeout(r, 2000))

          const resultData = await runMonitoringCheck(prompt, brand, engine, prompt.user_id)

          const insertPayload = {
            ...resultData,
            competitor_mentions: resultData.competitor_mentions as unknown as Json,
            hallucination_flags: resultData.hallucination_flags as unknown as Json,
            sentiment_aspects: resultData.sentiment_aspects as unknown as Json,
            response_text:
              resultData.response_text.length > 5000
                ? resultData.response_text.slice(0, 5000) + '…'
                : resultData.response_text,
          }
          const { data: saved, error: insertError } = await supabase
            .from('monitoring_results')
            .insert(insertPayload)
            .select()
            .single()

          if (insertError) {
            logger.error('DB insert error', { source: 'cron', engine, error: String(insertError) })
            results.push({ promptId: prompt.id, engine, success: false, error: 'DB insert failed' })
            hasErrors = true
            continue
          }

          engineResults.push(saved as unknown as MonitoringResult)
          results.push({ promptId: prompt.id, engine, success: true })

          // ── Evaluate alert rules for this result ─────────────────────────
          if (alertRules && alertRules.length > 0) {
            const previousResult = (previousResults as unknown as MonitoringResult[])?.find(
              (r) => r.engine === engine,
            )
            for (const rule of alertRules as AlertRule[]) {
              if (
                !shouldTriggerAlert(rule, {
                  result: saved as unknown as MonitoringResult,
                  previousResult,
                  brand,
                })
              ) {
                continue
              }
              const event = buildAlertEvent(rule, saved as unknown as MonitoringResult, brand)
              const { brand: _b, alert_rule: _ar, data: eventData, ...eventRest } = event
              const { data: savedEvent } = await supabase
                .from('alert_events')
                .insert({
                  ...eventRest,
                  data: eventData as unknown as Json,
                  user_id: prompt.user_id,
                })
                .select()
                .single()
              if (savedEvent) {
                let channelsSent: string[] = []
                try {
                  channelsSent = await dispatchAlert(
                    savedEvent as Parameters<typeof dispatchAlert>[0],
                    rule,
                    brand,
                  )
                } catch (dispatchErr) {
                  logger.error('dispatchAlert failed', {
                    source: 'cron',
                    ruleId: rule.id,
                    error: String(dispatchErr),
                  })
                }
                await supabase
                  .from('alert_events')
                  .update({ channels_sent: channelsSent })
                  .eq('id', savedEvent.id)
                await supabase
                  .from('alert_rules')
                  .update({ last_fired_at: new Date().toISOString() })
                  .eq('id', rule.id)
              }
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          logger.error('Engine failed for prompt', {
            source: 'cron',
            engine,
            prompt: prompt.text.slice(0, 50),
            error: msg,
          })
          results.push({ promptId: prompt.id, engine, success: false, error: msg })
          hasErrors = true
        }
      }

      if (workflowId) {
        await updateWorkflowStep(
          supabase,
          workflowId,
          'Execute monitoring',
          hasErrors ? 'failed' : 'completed',
        )
        await updateWorkflowStep(supabase, workflowId, 'Save results', 'completed')
      }

      await supabase.from('prompts').update({ last_run_at: now.toISOString() }).eq('id', prompt.id)

      if (engineResults.length > 0) {
        const { avi, components } = calculateAVIFromResults(engineResults)
        const citedCount = engineResults.filter((r) => r.cited_urls?.length > 0).length

        await supabase.from('brand_health_scores').upsert(
          {
            brand_id: brand.id,
            user_id: prompt.user_id,
            date: now.toISOString().split('T')[0]!,
            visibility_score: components.mentionFrequency,
            sentiment_score: components.sentimentScore,
            hallucination_rate: components.hallucinationIndex / 100,
            mention_count: engineResults.filter((r) => r.brand_mentioned).length,
            citation_count: citedCount,
            avi_score: avi,
            citation_rate: components.citationRate,
            mention_rate: components.mentionFrequency,
            recommendation_rate: components.recommendationRate,
            position_avg: components.positionAvg,
            health_score: avi,
            engine_breakdown: JSON.stringify(
              Object.fromEntries(engineResults.map((r) => [r.engine, r.visibility_score])),
            ),
          },
          { onConflict: 'brand_id,date' },
        )

        if (workflowId) {
          await updateWorkflowStep(supabase, workflowId, 'Update health scores', 'completed')
        }
      }

      processedBrands.add(brand.id)
    }

    for (const bId of processedBrands) {
      try {
        await calculateCitationSnapshots(bId as string)
      } catch (snapErr) {
        logger.error('Snapshot calculation failed', {
          source: 'cron',
          brandId: String(bId),
          error: String(snapErr),
        })
      }
    }

    const succeeded = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Cron complete: ${succeeded} succeeded, ${failed} failed across ${prompts.length} prompts`,
      results,
    })
  } catch (error) {
    logger.error('Unhandled error', { source: 'cron', error: String(error) })
    return NextResponse.json({ success: false, message: 'Cron job failed' }, { status: 500 })
  }
}
