// PATH: src/app/api/aeo-snippets/route.ts
// GET: list snippets for a brand (with filters).
// POST: trigger a new generation run from a keyword.

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { runAEOGeneration } from '@/lib/services/aeo-snippets'
// v2 API strategy: SerpApi removed. PAA is now DataForSEO (narrow scope) and
// gap-detection is Brave Search. We surface both quotas so the operator
// dashboard / UI can show capacity for each surface independently.
import { getDataforseoQuota } from '@/lib/services/dataforseo-quota'
import { getBraveQuota } from '@/lib/services/brave-search'
import { logger } from '@/lib/logger'

// aeo_* tables not yet in generated types; cast db at boundary.

function err(msg: string, status = 500) {
  return NextResponse.json({ success: false, message: msg }, { status })
}

async function auth(req: NextRequest): Promise<string | NextResponse> {
  try {
    return await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    }
    return err('Authentication failed', 401)
  }
}

const runSchema = z.object({
  brand_id: z.string().uuid(),
  keyword: z.string().min(2).max(200),
  language: z.enum(['en', 'it', 'sv']).optional(),
  max_questions: z.number().int().min(1).max(10).optional(),
  detect_gaps: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const userId = await auth(req)
  if (userId instanceof NextResponse) return userId

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const brandId = req.nextUrl.searchParams.get('brand_id')
  const gap = req.nextUrl.searchParams.get('gap')
  const keyword = req.nextUrl.searchParams.get('keyword')
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '100', 10) || 100, 500)

  if (!brandId) return err('brand_id is required', 400)

  const { data: brand } = await db
    .from('brands')
    .select('id')
    .eq('id', brandId)
    .eq('user_id', userId)
    .single()
  if (!brand) return err('Brand not found or access denied', 404)

  let q = db
    .from('aeo_snippets')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (gap && ['covered', 'gap', 'unknown'].includes(gap)) q = q.eq('gap_status', gap)
  if (keyword) q = q.eq('keyword', keyword)

  const { data: snippets, error } = await q
  if (error) {
    logger.error('aeo-snippets GET failed', { error: String(error) })
    return err(error.message)
  }

  const { data: runs } = await db
    .from('aeo_runs')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(20)

  const [dataforseoQuota, braveQuota] = await Promise.all([getDataforseoQuota(), getBraveQuota()])

  const counts = { total: 0, gap: 0, covered: 0, unknown: 0 }
  for (const s of (snippets || []) as Array<{ gap_status: string }>) {
    counts.total++
    if (s.gap_status === 'gap') counts.gap++
    else if (s.gap_status === 'covered') counts.covered++
    else counts.unknown++
  }

  return NextResponse.json({
    success: true,
    data: {
      snippets: snippets || [],
      runs: runs || [],
      counts,
      dataforseoQuota,
      braveQuota,
    },
    timestamp: Date.now(),
  })
}

export async function POST(req: NextRequest) {
  const userId = await auth(req)
  if (userId instanceof NextResponse) return userId

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const parsed = runSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues.map((i) => i.message).join('; '), 400)

  try {
    const result = await runAEOGeneration({
      brandId: parsed.data.brand_id,
      userId,
      keyword: parsed.data.keyword,
      language: parsed.data.language,
      maxQuestions: parsed.data.max_questions,
      detectGaps: parsed.data.detect_gaps,
    })
    return NextResponse.json({ success: true, data: result, timestamp: Date.now() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('aeo-snippets POST failed', { error: msg })
    return err(msg)
  }
}
