// PATH: src/app/api/annotations/route.ts
//
// CRUD for brand_annotations.
//
// GET    /api/annotations?brand_id=…&days=180   → list
// POST   /api/annotations { brand_id, event_date, type, label, url?, notes? }
// DELETE /api/annotations?id=…
//
// Annotations are operator-recorded events (content publishes, product
// launches, earned media, competitor moves, campaigns, algorithm
// updates) used to overlay context on AI visibility timelines. See
// migration 20260525000000_add_brand_annotations.sql for the schema.

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const ANNOTATION_TYPES = [
  'content_publish',
  'product_launch',
  'earned_media',
  'competitor_move',
  'campaign',
  'algorithm_update',
  'other',
] as const

const postSchema = z.object({
  brand_id: z.string().uuid(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'event_date must be YYYY-MM-DD'),
  type: z.enum(ANNOTATION_TYPES),
  label: z.string().min(1).max(200),
  url: z.string().url().max(500).optional(),
  notes: z.string().max(2000).optional(),
})

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
  const days = Math.min(720, Math.max(7, Number(searchParams.get('days')) || 180))
  if (!brandId) return err('brand_id is required', 400)
  if (!(await verifyBrandAccess(brandId, userId))) return err('Forbidden', 403)

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceDate = since.toISOString().slice(0, 10)

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data, error } = await (db as any)
    .from('brand_annotations')
    .select('id, brand_id, event_date, type, label, url, notes, created_at')
    .eq('brand_id', brandId)
    .gte('event_date', sinceDate)
    .order('event_date', { ascending: false })
    .limit(500)
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (error) {
    logger.error('/api/annotations GET failed', { err: String(error) })
    return err('Failed to load annotations')
  }

  return NextResponse.json({
    success: true,
    data: { annotations: data ?? [], filters: { days } },
    timestamp: Date.now(),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues.map((i) => i.message).join('; '), 400)

  const { brand_id, event_date, type, label, url, notes } = parsed.data
  if (!(await verifyBrandAccess(brand_id, userId))) return err('Forbidden', 403)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data, error } = await (db as any)
    .from('brand_annotations')
    .insert({
      brand_id,
      user_id: userId,
      event_date,
      type,
      label,
      url: url ?? null,
      notes: notes ?? null,
    })
    .select('id, brand_id, event_date, type, label, url, notes, created_at')
    .single()
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (error) {
    logger.error('/api/annotations POST failed', { err: String(error) })
    return err('Failed to create annotation')
  }

  return NextResponse.json({ success: true, data, timestamp: Date.now() })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return err('id is required', 400)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // Confirm the annotation belongs to a brand the user owns before deletion.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data: row, error: lookupErr } = await (db as any)
    .from('brand_annotations')
    .select('id, brand_id')
    .eq('id', id)
    .single()
  /* eslint-enable @typescript-eslint/no-explicit-any */
  if (lookupErr || !row) return err('Annotation not found', 404)
  if (!(await verifyBrandAccess(row.brand_id as string, userId))) return err('Forbidden', 403)

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { error } = await (db as any).from('brand_annotations').delete().eq('id', id)
  /* eslint-enable @typescript-eslint/no-explicit-any */
  if (error) {
    logger.error('/api/annotations DELETE failed', { err: String(error) })
    return err('Failed to delete annotation')
  }
  return NextResponse.json({ success: true, timestamp: Date.now() })
}
