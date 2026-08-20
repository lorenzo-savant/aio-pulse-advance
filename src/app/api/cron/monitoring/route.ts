// PATH: src/app/api/cron/monitoring/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import type { Json } from '@/types/database'
import { createServerClient } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'
import { runMonitoringCheck, calculateAVIFromResults } from '@/lib/services/monitoring'
import { consumeCreditsForQuery } from '@/lib/services/credits'
import { getCostTracker } from '@/lib/cost-monitor'
import { estimateBlendedCost, pricingKeyForProviderLabel } from '@/lib/cost-monitor/types'
import { shouldTriggerAlert, buildAlertEvent, dispatchAlert } from '@/lib/services/alerts'
import type { Brand, Prompt, MonitoringResult, WorkflowStatus, AlertRule } from '@/types'
import { ACTIVE_ENGINES, isActiveEngine } from '@/types'
import { providerMatchesEngine } from '@/lib/services/engine-provenance'
import { calculateCitationSnapshots } from '@/lib/services/citation-snapshots'
import { auditBrandMentions, type BrandContext } from '@/lib/services/homonym-audit'
import { shouldAnchorBrandDomain } from '@/lib/services/prompt-generator'

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

// Prompts processed per cron run. Engines fan out in PARALLEL per prompt
// (see below), so one prompt costs roughly one LLM round-trip of wall-clock,
// not four — that is what allows a cap above the old hardcoded 3. Tunable
// without a deploy via CRON_MONITORING_MAX_PROMPTS, clamped to 1–20 so a
// typo can't blow the maxDuration budget. Scaling beyond this cap needs a
// real job queue (see docs/enterprise-roadmap), not a bigger number.
const MAX_PROMPTS_PER_RUN = Math.min(
  20,
  Math.max(1, Number(process.env['CRON_MONITORING_MAX_PROMPTS']) || 6),
)

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
      .limit(MAX_PROMPTS_PER_RUN)

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

    // Every engine result of this run, grouped by brand, so the daily health row
    // can be computed over all of them instead of the last prompt processed.
    const resultsByBrand = new Map<string, { userId: string; results: MonitoringResult[] }>()

    for (const promptRow of prompts) {
      const brand = promptRow.brand as unknown as Brand
      if (!brand || !brand.is_active) continue

      const prompt = promptRow as unknown as Prompt
      // Same gate as the interactive route: a retired engine is never called,
      // whatever the stored prompt lists. The cron is the higher-volume path,
      // so this is where a per-run price difference compounds.
      const engines = (prompt.engines || [...ACTIVE_ENGINES]).filter(isActiveEngine)

      // ── Credit gate ─────────────────────────────────────────────────────
      // A scheduled run buys exactly the same paid LLM work as the manual
      // path, so it goes through the same ledger. This was missing entirely:
      // consumeCreditsForQuery had two call sites, /api/credits/use and the
      // manual /api/monitoring path, so every cron run spent engine calls that
      // nothing recorded. The owner was never in doubt — prompt.user_id is the
      // identity already passed to runMonitoringCheck below.
      //
      // A refusal skips THIS prompt and nothing else: one tenant out of credit
      // must not stop the run for every other tenant. A gate that could not be
      // evaluated also skips, for the reason the manual path gives — never run
      // paid work when the credit check itself failed.
      try {
        const creditDecision = await consumeCreditsForQuery(prompt.user_id, {
          engines,
          brandId: brand.id,
          queryId: prompt.id,
        })

        if (!creditDecision.allowed) {
          logger.info('Skipping scheduled prompt — insufficient credits', {
            source: 'cron',
            brandId: brand.id,
            promptId: prompt.id,
            cost: creditDecision.cost,
          })
          for (const engine of engines) {
            results.push({
              promptId: prompt.id,
              engine,
              success: false,
              error: creditDecision.message || 'Insufficient credits',
            })
          }
          continue
        }
      } catch (creditErr) {
        logger.error('Credit check failed for scheduled prompt — skipping', {
          source: 'cron',
          brandId: brand.id,
          promptId: prompt.id,
          error: creditErr instanceof Error ? creditErr.message : String(creditErr),
        })
        for (const engine of engines) {
          results.push({
            promptId: prompt.id,
            engine,
            success: false,
            error: 'Credit check failed',
          })
        }
        continue
      }

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
      // …) just like manual runs do. One most-recent row PER engine — a single
      // `.limit(engines.length)` query lets one engine's history crowd out the
      // others, so their change-based alerts never fired.
      const previousResults = (
        await Promise.all(
          engines.map((engine) =>
            supabase
              .from('monitoring_results')
              .select('*')
              .eq('prompt_id', prompt.id)
              .eq('engine', engine)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
          ),
        )
      )
        .map((r) => r.data)
        .filter((r) => r != null) as unknown as MonitoringResult[]

      const { data: alertRules } = await supabase
        .from('alert_rules')
        .select('*')
        .eq('brand_id', brand.id)
        .eq('is_active', true)

      // Fan out the LLM calls in parallel — engines are independent, and the
      // manual /api/monitoring path already runs them with Promise.all. The
      // old serial loop here (2s sleep + sequential awaits) made each prompt
      // cost ~4× the wall-clock, which is why the run cap had to sit at 3.
      // DB writes + alert evaluation stay serial below to keep their
      // ordering semantics unchanged.
      const engineOutcomes = await Promise.allSettled(
        engines.map((engine) => runMonitoringCheck(prompt, brand, engine, prompt.user_id)),
      )

      for (let i = 0; i < engines.length; i++) {
        const engine = engines[i]!
        const outcome = engineOutcomes[i]!
        if (outcome.status === 'rejected') {
          const msg =
            outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)
          logger.error('Engine failed for prompt', {
            source: 'cron',
            engine,
            prompt: prompt.text.slice(0, 50),
            error: msg,
          })
          results.push({ promptId: prompt.id, engine, success: false, error: msg })
          hasErrors = true
          continue
        }
        try {
          const resultData = outcome.value

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

          // ── Record what this run cost ──────────────────────────────────
          // The interactive route got this writer; the cron did not — and the
          // cron is the bigger consumer by far, three passes a day across every
          // active prompt against every engine. With only the interactive path
          // logging, ai_cost_logs stayed at 0 rows and both dashboards plus the
          // budget manager kept reading an empty table, which is why the gap
          // survived being "fixed". Best-effort: a failure here must never lose
          // a result already persisted and paid for.
          try {
            const provider = String(resultData.response_provider ?? engine)
            const promptTokens = Math.ceil((resultData.prompt_text?.length ?? 0) / 4)
            const responseTokens = Math.ceil((resultData.response_text?.length ?? 0) / 4)
            await getCostTracker().logCost({
              userId: prompt.user_id,
              brandId: brand.id,
              provider,
              model: pricingKeyForProviderLabel(provider),
              inputTokens: promptTokens,
              outputTokens: responseTokens,
              costUsd: estimateBlendedCost(provider, promptTokens + responseTokens),
              costCredits: 0,
              endpoint: '/api/cron/monitoring',
              success: true,
            })
          } catch (costErr) {
            logger.warn('cron: cost logging failed', {
              source: 'cron',
              engine,
              error: String(costErr),
            })
          }

          // ── Evaluate alert rules for this result ─────────────────────────
          if (alertRules && alertRules.length > 0) {
            const previousResult = previousResults.find((r) => r.engine === engine)
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
          logger.error('Engine post-processing failed for prompt', {
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

      // The daily health row is a BRAND aggregate, so it cannot be written from
      // inside this loop: the upsert lives on (brand_id, date), so each prompt
      // overwrote the previous one and only the last of the run survived. Every
      // consumer — GEO score, the AVI widget, the advisor, the weekly review —
      // then read a whole-brand daily metric that was really one arbitrary
      // prompt measured over n≈4. Accumulate, write once per brand below.
      if (engineResults.length > 0) {
        const bucket = resultsByBrand.get(brand.id)
        if (bucket) {
          bucket.results.push(...engineResults)
        } else {
          resultsByBrand.set(brand.id, {
            userId: prompt.user_id,
            results: [...engineResults],
          })
        }

        if (workflowId) {
          await updateWorkflowStep(supabase, workflowId, 'Update health scores', 'completed')
        }
      }

      processedBrands.add(brand.id)
    }

    // ── Daily brand health, once per brand, over every result of this run ────
    for (const [brandId, { userId, results: brandResults }] of resultsByBrand) {
      const { avi, components } = calculateAVIFromResults(brandResults)
      const citedCount = brandResults.filter((r) => r.cited_urls?.length > 0).length

      await supabase.from('brand_health_scores').upsert(
        {
          brand_id: brandId,
          user_id: userId,
          date: now.toISOString().split('T')[0]!,
          visibility_score: components.mentionFrequency,
          sentiment_score: components.sentimentScore,
          // null, not 0: nothing assessed it is not the same as nothing found.
          hallucination_rate:
            components.hallucinationIndex == null ? null : components.hallucinationIndex / 100,
          mention_count: brandResults.filter((r) => r.brand_mentioned).length,
          citation_count: citedCount,
          avi_score: avi,
          citation_rate: components.citationRate,
          mention_rate: components.mentionFrequency,
          recommendation_rate: components.recommendationRate,
          position_avg: components.positionAvg,
          health_score: avi,
          engine_breakdown: JSON.stringify(
            // Per-engine slots only accept rows the engine's own provider
            // answered — a fallback-served row is not that engine's number.
            Object.fromEntries(
              brandResults
                .filter((r) => providerMatchesEngine(r.engine, r.response_provider))
                .map((r) => [r.engine, r.visibility_score]),
            ),
          ),
        },
        { onConflict: 'brand_id,date' },
      )
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

    // ── Automatic homonym guard ──────────────────────────────────────────────
    // Stop a brand's metrics from silently counting mentions of a same-named
    // OTHER company (Relovie vs "Relove Nordic" / relove.co.uk). The manual
    // audit panel already existed; running it here makes the protection
    // automatic for every cycle, so a client never has to know to click it.
    // Scoped to homonym-prone brands (short single-word names, or any brand the
    // operator gave a disambiguation) so distinctive multi-word names don't pay
    // for a classifier pass they don't need — and bounded, because
    // auditBrandMentions only classifies the NEW pending mentions this run
    // produced. Best-effort + env-gated: it must never fail a cycle, and
    // CRON_HOMONYM_AUDIT=off turns it off for cost.
    if (process.env['CRON_HOMONYM_AUDIT'] !== 'off') {
      for (const bId of processedBrands) {
        try {
          const { data: b } = await supabase
            .from('brands')
            .select('name, domain, industry, description, aliases, disambiguation')
            .eq('id', bId)
            .maybeSingle()
          if (!b) continue
          const ctx = b as BrandContext
          if (!shouldAnchorBrandDomain(ctx.name) && !ctx.disambiguation?.trim()) continue
          await auditBrandMentions(supabase, bId as string, ctx, { limit: 25 })
        } catch (auditErr) {
          // A missing confusion column (migration not applied) lands here too and
          // simply skips — the monitoring cycle must never fail on the guard.
          logger.warn('cron: homonym auto-audit skipped', {
            source: 'cron',
            brandId: String(bId),
            error: auditErr instanceof Error ? auditErr.message : String(auditErr),
          })
        }
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

// Vercel Cron triggers via HTTP GET. Alias GET to POST so the same
// handler runs whether the scheduler hits it or a human triggers it
// manually via authenticated POST.
export const GET = POST
