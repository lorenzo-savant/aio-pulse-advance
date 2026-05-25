// PATH: src/app/api/claim-divergence/route.ts
//
// Reports cases where AI engines disagree about factual claims for the
// same prompt (founding year, HQ, founder, team size, pricing, funding).
// Implements the operator-facing surface for the Semrush "find and fix
// what AI gets wrong about your brand" playbook — zero extra API calls,
// just regex over response_text we already store.
//
// GET /api/claim-divergence?brand_id=…&days=180

import { type NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { createServerClient } from '@/lib/supabase'
import { buildDivergenceReport } from '@/lib/utils/claim-divergence'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const days = Math.min(720, Math.max(7, Number(searchParams.get('days')) || 180))
  if (!brandId) return err('brand_id is required', 400)
  if (!(await verifyBrandAccess(brandId, userId))) return err('Forbidden', 403)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const since = new Date()
  since.setDate(since.getDate() - days)

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data, error } = await (db as any)
    .from('monitoring_results')
    .select('prompt_id, engine, response_text, prompt:prompts(text)')
    .eq('brand_id', brandId)
    .gte('created_at', since.toISOString())
    .not('response_text', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5000)
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (error) {
    logger.error('/api/claim-divergence query failed', { err: String(error) })
    return err('Failed to load monitoring data')
  }

  const rows = (
    (data ?? []) as Array<{
      prompt_id: string | null
      engine: string
      response_text: string | null
      prompt?: { text?: string | null } | null
    }>
  ).map((r) => ({
    prompt_id: r.prompt_id,
    prompt_text: r.prompt?.text ?? null,
    engine: r.engine,
    response_text: r.response_text,
  }))

  // For each (prompt × engine) keep only the MOST RECENT response so a
  // single old contradiction isn't replayed forever after the operator
  // fixes the source. Order desc by created_at above + a Set on the
  // composite key.
  const seen = new Set<string>()
  const latestPerPair = rows.filter((r) => {
    if (!r.prompt_id) return false
    const key = `${r.prompt_id}::${r.engine}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const report = buildDivergenceReport(latestPerPair)

  return NextResponse.json({
    success: true,
    data: {
      ...report,
      // Surface a small preview so the panel can render even when many
      // prompts diverge — the UI paginates client-side.
      promptsCount: report.prompts.length,
      filters: { days },
    },
    timestamp: Date.now(),
  })
}
