// PATH: src/app/api/brand-facts/route.ts
//
// CRUD for brand_facts. Each brand has at most one canonical value per
// fact_type (enforced by a unique index in the migration), so POST acts
// as an upsert.
//
// GET    /api/brand-facts?brand_id=…           → list facts + verification report
// POST   /api/brand-facts { brand_id, fact_type, value, notes? }
// DELETE /api/brand-facts?id=…

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { runFactVerification } from '@/lib/services/fact-verifier'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const FACT_TYPES = [
  'founding_year',
  'headquarters',
  'founder',
  'team_size',
  'pricing',
  'funding',
] as const

const upsertSchema = z.object({
  brand_id: z.string().uuid(),
  fact_type: z.enum(FACT_TYPES),
  value: z.string().min(1).max(200),
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

  const brandId = req.nextUrl.searchParams.get('brand_id')
  if (!brandId) return err('brand_id is required', 400)
  if (!(await verifyBrandAccess(brandId, userId))) return err('Forbidden', 403)

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data, error } = await (db as any)
    .from('brand_facts')
    .select('id, brand_id, fact_type, value, notes, created_at, updated_at')
    .eq('brand_id', brandId)
    .order('fact_type', { ascending: true })
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (error) {
    logger.error('/api/brand-facts GET failed', { err: String(error) })
    return err('Failed to load brand facts')
  }

  const verification = await runFactVerification(brandId)

  return NextResponse.json({
    success: true,
    data: { facts: data ?? [], verification },
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
  const parsed = upsertSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues.map((i) => i.message).join('; '), 400)

  const { brand_id, fact_type, value, notes } = parsed.data
  if (!(await verifyBrandAccess(brand_id, userId))) return err('Forbidden', 403)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data, error } = await (db as any)
    .from('brand_facts')
    .upsert(
      {
        brand_id,
        user_id: userId,
        fact_type,
        value,
        notes: notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'brand_id,fact_type' },
    )
    .select('id, brand_id, fact_type, value, notes, created_at, updated_at')
    .single()
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (error) {
    logger.error('/api/brand-facts POST failed', { err: String(error) })
    return err('Failed to save brand fact')
  }

  return NextResponse.json({ success: true, data, timestamp: Date.now() })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return err('id is required', 400)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data: row, error: lookupErr } = await (db as any)
    .from('brand_facts')
    .select('id, brand_id')
    .eq('id', id)
    .single()
  /* eslint-enable @typescript-eslint/no-explicit-any */
  if (lookupErr || !row) return err('Brand fact not found', 404)
  if (!(await verifyBrandAccess(row.brand_id as string, userId))) return err('Forbidden', 403)

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { error } = await (db as any).from('brand_facts').delete().eq('id', id)
  /* eslint-enable @typescript-eslint/no-explicit-any */
  if (error) {
    logger.error('/api/brand-facts DELETE failed', { err: String(error) })
    return err('Failed to delete brand fact')
  }
  return NextResponse.json({ success: true, timestamp: Date.now() })
}
