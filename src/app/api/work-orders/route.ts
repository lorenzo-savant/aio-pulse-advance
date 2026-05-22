// PATH: src/app/api/work-orders/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Json } from '@/types/database'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { currentGeoScore } from '@/lib/services/work-orders'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

const round1 = (v: number) => Math.round(v * 10) / 10

const createSchema = z.object({
  brand_id: z.string().uuid(),
  title: z.string().min(3).max(200),
  category: z.string().max(40).optional(),
  impact: z.enum(['high', 'medium', 'low']).optional(),
  effort: z.enum(['high', 'medium', 'low']).optional(),
  rationale: z.string().max(2000).optional(),
  actions: z.array(z.string().max(500)).max(12).optional(),
  source: z.enum(['advisor', 'audit', 'manual']).optional(),
})

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['open', 'in_progress', 'done', 'dismissed']),
})

// ─── GET /api/work-orders?brand_id= — list a brand's work orders ─────────────
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const brandId = new URL(req.url).searchParams.get('brand_id')
  if (!brandId) return err('brand_id is required', 400)
  if (!(await verifyBrandAccess(brandId, userId)))
    return err('Brand not found or access denied', 404)

  try {
    const { data, error } = await (db as any)
      .from('work_orders')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      // Table may not exist yet (migration not applied) — degrade to empty.
      logger.warn('/api/work-orders list failed', { err: String(error) })
      return NextResponse.json({ success: true, data: [], timestamp: Date.now() })
    }
    return NextResponse.json({ success: true, data: data ?? [], timestamp: Date.now() })
  } catch (e) {
    logger.error('/api/work-orders GET error', { err: String(e) })
    return NextResponse.json({ success: true, data: [], timestamp: Date.now() })
  }
}

// ─── POST /api/work-orders — create a trackable work order ───────────────────
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }
  const d = parsed.data
  if (!(await verifyBrandAccess(d.brand_id, userId))) {
    return err('Brand not found or access denied', 404)
  }

  // Snapshot the GEO score now → the baseline we'll re-check against on completion.
  const baseline = await currentGeoScore(d.brand_id)

  try {
    const { data, error } = await (db as any)
      .from('work_orders')
      .insert({
        brand_id: d.brand_id,
        user_id: userId,
        title: d.title,
        category: d.category ?? null,
        impact: d.impact ?? null,
        effort: d.effort ?? null,
        rationale: d.rationale ?? null,
        actions: (d.actions ?? []) as unknown as Json,
        source: d.source ?? 'advisor',
        baseline_geo_score: baseline,
      })
      .select()
      .single()
    if (error) return err(error.message)
    return NextResponse.json({ success: true, data, timestamp: Date.now() })
  } catch (e) {
    logger.error('/api/work-orders POST error', { err: String(e) })
    return err('Failed to create work order')
  }
}

// ─── PATCH /api/work-orders — update status (recheck GEO on completion) ──────
export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }
  const { id, status } = parsed.data

  try {
    // Load the work order (scoped to the user) to get its brand + baseline.
    const { data: existing } = await (db as any)
      .from('work_orders')
      .select('id, brand_id, baseline_geo_score')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!existing) return err('Work order not found', 404)

    const update: Record<string, unknown> = { status }
    if (status === 'done') {
      const recheck = await currentGeoScore(existing.brand_id)
      update.recheck_geo_score = recheck
      update.recheck_delta =
        recheck != null && existing.baseline_geo_score != null
          ? round1(recheck - existing.baseline_geo_score)
          : null
      update.completed_at = new Date().toISOString()
    } else {
      update.completed_at = null
    }

    const { data, error } = await (db as any)
      .from('work_orders')
      .update(update)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()
    if (error) return err(error.message)
    return NextResponse.json({ success: true, data, timestamp: Date.now() })
  } catch (e) {
    logger.error('/api/work-orders PATCH error', { err: String(e) })
    return err('Failed to update work order')
  }
}
