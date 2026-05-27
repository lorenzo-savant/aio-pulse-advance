// PATH: src/app/api/prompts/portfolio/route.ts
//
// GET /api/prompts/portfolio?brand_id=…&days=30
//
// Classifies the brand's tracked prompts into the 4-bucket business-impact
// portfolio (revenue / reputation / competitor / gap / other) per the
// industry research "Prompt Tracking" piece, and adds an aggregate brand-visibility
// metric per bucket from the recent monitoring_results.
//
// Pure aggregation. No external API.

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { classifyPromptList } from '@/lib/utils/prompt-portfolio'
import { logger } from '@/lib/logger'
import type { Brand } from '@/types'

export const dynamic = 'force-dynamic'

interface PromptRow {
  id: string
  text: string
}

interface MonitoringRow {
  prompt_id: string | null
  brand_mentioned: boolean | null
}

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const days = Math.min(365, Math.max(7, Number(searchParams.get('days')) || 30))

  if (!brandId) return err('brand_id is required', 400)
  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) return err('Brand not found or access denied', 404)
  const b = brand as Brand

  const since = new Date()
  since.setDate(since.getDate() - days)

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const [{ data: prompts, error: pErr }, { data: monitoring, error: mErr }] = await Promise.all([
      (db as any)
        .from('prompts')
        .select('id, text')
        .eq('brand_id', brandId)
        .eq('user_id', userId)
        .limit(500),
      (db as any)
        .from('monitoring_results')
        .select('prompt_id, brand_mentioned')
        .eq('brand_id', brandId)
        .gte('created_at', since.toISOString())
        .limit(5000),
    ])
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (pErr || mErr) {
      logger.error('/api/prompts/portfolio query failed', {
        pErr: String(pErr),
        mErr: String(mErr),
      })
      return err('Failed to load prompts or monitoring data')
    }

    const promptList = ((prompts ?? []) as PromptRow[]).filter(
      (p) => typeof p.text === 'string' && p.text.trim().length > 0,
    )

    // Per-prompt brand visibility = % of monitoring rows where
    // brand_mentioned=true, in the window.
    const aggByPrompt = new Map<string, { total: number; hits: number }>()
    for (const row of (monitoring ?? []) as MonitoringRow[]) {
      const pid = row.prompt_id || ''
      if (!pid) continue
      const agg = aggByPrompt.get(pid) ?? { total: 0, hits: 0 }
      agg.total++
      if (row.brand_mentioned === true) agg.hits++
      aggByPrompt.set(pid, agg)
    }

    const inputs = promptList.map((p) => {
      const a = aggByPrompt.get(p.id)
      const brandVisibility = a && a.total > 0 ? Math.round((a.hits / a.total) * 1000) / 10 : null
      return { promptId: p.id, prompt: p.text, brandVisibility }
    })

    const report = classifyPromptList(inputs, {
      brandName: b.name,
      brandAliases: b.aliases ?? [],
      competitorNames: b.competitors ?? [],
    })

    return NextResponse.json({
      success: true,
      data: { report, filters: { days } },
      timestamp: Date.now(),
    })
  } catch (e) {
    logger.error('/api/prompts/portfolio failed', { err: String(e) })
    return err('Failed to classify prompt portfolio')
  }
}
