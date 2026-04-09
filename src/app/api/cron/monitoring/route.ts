// PATH: src/app/api/cron/monitoring/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { runMonitoringCheck, calculateHealthScore } from '@/lib/services/monitoring'
import type { Brand, Prompt, MonitoringResult, MonitoringEngine } from '@/types'
import { calculateCitationSnapshots } from '@/lib/services/citation-snapshots'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min (Vercel Pro) or 60s (Hobby)

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
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
    const { data: prompts, error: promptsError } = await (supabase as any)
      .from('prompts')
      .select('*, brand:brands(*)')
      .eq('is_active', true)
      .or(
        `last_run_at.is.null,and(run_frequency.eq.hourly,last_run_at.lte.${oneHourAgo}),and(run_frequency.eq.daily,last_run_at.lte.${oneDayAgo}),and(run_frequency.eq.weekly,last_run_at.lte.${oneWeekAgo})`,
      )
      .limit(3) // Process max 10 prompts per cron run to stay within timeout

    if (promptsError) {
      console.error('[cron] Error fetching prompts:', promptsError)
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
      const brand = promptRow.brand as Brand
      if (!brand || !brand.is_active) continue

      const prompt = promptRow as Prompt
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
          const { data: saved, error: insertError } = await (supabase as any)
            .from('monitoring_results')
            .insert({
              ...resultData,
              response_text:
                resultData.response_text.length > 5000
                  ? resultData.response_text.slice(0, 5000) + '…'
                  : resultData.response_text,
            })
            .select()
            .single()

          if (insertError) {
            console.error(`[cron] DB insert error for ${engine}:`, insertError)
            results.push({ promptId: prompt.id, engine, success: false, error: 'DB insert failed' })
            continue
          }

          engineResults.push(saved as MonitoringResult)
          results.push({ promptId: prompt.id, engine, success: true })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`[cron] ${engine} failed for prompt "${prompt.text.slice(0, 50)}":`, msg)
          results.push({ promptId: prompt.id, engine, success: false, error: msg })
        }
      }

      // ── Update prompt last_run_at ─────────────────────────────────────────
      await (supabase as any)
        .from('prompts')
        .update({ last_run_at: now.toISOString() })
        .eq('id', prompt.id)

      // ── Update daily health score ─────────────────────────────────────────
      if (engineResults.length > 0) {
        const avgVisibility =
          engineResults.reduce((a, r) => a + r.visibility_score, 0) / engineResults.length
        const mentionedResults = engineResults.filter((r) => r.brand_mentioned)
        const avgSentiment =
          mentionedResults.length > 0
            ? mentionedResults.reduce((a, r) => a + (r.sentiment_score ?? 0), 0) /
              mentionedResults.length
            : 0
        const hallucinationRate =
          engineResults.filter((r) => r.has_hallucination).length / engineResults.length
        const healthScore = calculateHealthScore(avgVisibility, avgSentiment, hallucinationRate)

        await (supabase as any).from('brand_health_scores').upsert(
          {
            brand_id: brand.id,
            user_id: prompt.user_id,
            date: now.toISOString().split('T')[0],
            visibility_score: avgVisibility,
            sentiment_score: avgSentiment,
            hallucination_rate: hallucinationRate,
            mention_count: mentionedResults.length,
            health_score: healthScore,
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
        console.error(`[cron] Snapshot calculation failed for brand ${bId}:`, snapErr)
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
    console.error('[cron] Unhandled error:', error)
    return NextResponse.json({ success: false, message: 'Cron job failed' }, { status: 500 })
  }
}
