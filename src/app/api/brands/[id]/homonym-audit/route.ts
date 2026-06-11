// PATH: src/app/api/brands/[id]/homonym-audit/route.ts
//
// GET  → return current audit stats (counts + recent flagged mentions)
// POST → trigger one audit pass (up to ~50 pending rows per call) and
//        return both the run summary + the refreshed stats.
//
// Both are scoped to brands the caller can access via verifyBrandAccess.

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { auditBrandMentions, getAuditStats, type BrandContext } from '@/lib/services/homonym-audit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const homonymAuditBodySchema = z.object({
  limit: z.number().finite().optional(),
})

interface Params {
  params: Promise<{ id: string }>
}

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

async function loadBrandContext(
  db: NonNullable<ReturnType<typeof createServerClient>>,
  brandId: string,
  userId: string,
): Promise<BrandContext | null> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data, error } = await (db as any)
    .from('brands')
    .select('name, domain, industry, description, aliases, disambiguation')
    .eq('id', brandId)
    .eq('user_id', userId)
    .single()
  /* eslint-enable @typescript-eslint/no-explicit-any */
  if (error || !data) return null
  return data as BrandContext
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params

  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const brand = await verifyBrandAccess(id, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  const ip = getClientIp(req.headers)
  const rate = await checkRateLimit(`homonym-audit-get:${ip}`, 30, 60_000)
  if (!rate.success) return err('Rate limit exceeded', 429)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  try {
    const stats = await getAuditStats(db, id, 10)
    return NextResponse.json({ success: true, data: stats, timestamp: Date.now() })
  } catch (e) {
    // Soft-fail when the migration hasn't been applied yet: the columns
    // simply don't exist. Surface a friendly hint so the panel can show
    // an "apply migration" notice instead of breaking the page.
    const msg = e instanceof Error ? e.message : String(e)
    if (/confusion_(flag|audited_at|reason)/i.test(msg)) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Homonym audit columns missing — apply migration 20260526400000_monitoring_results_confusion.sql.',
          code: 'AUDIT_MIGRATION_PENDING',
        },
        { status: 503 },
      )
    }
    logger.error('homonym-audit GET failed', { brandId: id, error: msg })
    return err(msg)
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params

  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const brand = await verifyBrandAccess(id, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  const ip = getClientIp(req.headers)
  // Tighter limit on POST — audits cost LLM calls. 3 runs / minute is
  // plenty to drain a backlog incrementally without hammering quotas.
  const rate = await checkRateLimit(`homonym-audit-post:${ip}`, 3, 60_000)
  if (!rate.success) return err('Rate limit exceeded', 429)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const ctx = await loadBrandContext(db, id, userId)
  if (!ctx) return err('Brand context not loadable', 404)

  // Optional `limit` body param for power users / cron jobs to drain a
  // larger backlog at once. Default 50 keeps a manual run snappy.
  let limit = 50
  try {
    const parsed = homonymAuditBodySchema.safeParse(await req.json())
    if (parsed.success && parsed.data.limit && Number.isFinite(parsed.data.limit)) {
      limit = Math.min(200, Math.max(1, Math.floor(parsed.data.limit)))
    }
  } catch {
    // Empty body is fine; default limit applies.
  }

  try {
    const summary = await auditBrandMentions(db, id, ctx, { limit })
    const stats = await getAuditStats(db, id, 10)
    return NextResponse.json({
      success: true,
      data: { summary, stats },
      timestamp: Date.now(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/confusion_(flag|audited_at|reason)/i.test(msg)) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Homonym audit columns missing — apply migration 20260526400000_monitoring_results_confusion.sql.',
          code: 'AUDIT_MIGRATION_PENDING',
        },
        { status: 503 },
      )
    }
    logger.error('homonym-audit POST failed', { brandId: id, error: msg })
    return err(msg)
  }
}
