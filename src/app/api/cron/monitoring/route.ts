// PATH: src/app/api/cron/monitoring/route.ts
import { NextRequest, NextResponse } from 'next/server'
import type { Json } from '@/types/database'
import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import {
  runMonitoringCheck,
  calculateHealthScore,
  calculateAVIFromResults,
} from '@/lib/services/monitoring'
import type { Brand, Prompt, MonitoringResult, MonitoringEngine } from '@/types'
import { calculateCitationSnapshots } from '@/lib/services/citation-snapshots'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min (Vercel Pro) or 60s (Hobby)

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET_TOKEN
  if (!cronSecret) {
    return NextResponse.json({ success: false, message: 'Server misconfigured' }, { status: 500 })
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

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

    // ── Process each prompt sequentially to respect rate limits ────────────────
    for (const promptRow of prompts) {
      const brand = promptRow.brand as unknown as Brand
      if (!brand || !brand.is_active) continue

      const prompt = promptRow as unknown as Prompt
      const validEngines = ['chatgpt', 'gemini', 'perplexity', 'claude'] as const
      const engines = (prompt.engines || ['chatgpt', 'gemini', 'perplexity', 'claude']).filter(
        (e): e is MonitoringEngine => (validEngines as readonly string[]).includes(e),
      )

      const engineResults: MonitoringResult[] = []

      for (const engine of engines) {
        try {
          // Delay between engine calls to avoid rate limits
          await new Promise((r) => setTimeout(r, 2000))

          const resultData = await runMonitoringCheck(prompt, brand, engine, prompt.user_id)

          // Save to DB
          const insertPayload = {
            ...resultData,
            competitor_mentions: resultData.competitor_mentions as unknown as Json,
            hallucination_flags: resultData.hallucination_flags as unknown as Json,
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
            continue
          }

          engineResults.push(saved as unknown as MonitoringResult)
          results.push({ promptId: prompt.id, engine, success: true })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          logger.error('Engine failed for prompt', { source: 'cron', engine, prompt: prompt.text.slice(0, 50), error: msg })
          results.push({ promptId: prompt.id, engine, success: false, error: msg })
        }
      }

      // ── Update prompt last_run_at ─────────────────────────────────────────
      await supabase
        .from('prompts')
        .update({ last_run_at: now.toISOString() })
        .eq('id', prompt.id)

      // ── Update daily health score ─────────────────────────────────────────
      if (engineResults.length > 0) {
        const { avi, components } = calculateAVIFromResults(engineResults)
        const citedCount = engineResults.filter((r) => r.cited_urls?.length > 0).length

        await supabase.from('brand_health_scores').upsert(
          {
            brand_id: brand.id,
            user_id: prompt.user_id,
            date: now.toISOString().split('T')[0],
            visibility_score: components.mentionFrequency,
            sentiment_score: components.sentimentScore,
            hallucination_rate: components.hallucinationIndex / 100,
            mention_count: engineResults.filter((r) => r.brand_mentioned).length,
            citation_count: citedCount,
            // AVI component fields
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
      }
    }
    const processedBrands = [...new Set(prompts.map((p: any) => p.brand_id))]
    for (const bId of processedBrands) {
      try {
        await calculateCitationSnapshots(bId as string)
      } catch (snapErr) {
        logger.error('Snapshot calculation failed', { source: 'cron', brandId: String(bId), error: String(snapErr) })
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
