// PATH: src/app/api/brands/[id]/report-schedules/route.ts
//
// CRUD for scheduled PDF report deliveries per brand. RLS enforces
// user-scoping at the DB level so we just need to verify brand access.
//
//   GET    → list schedules for the brand
//   POST   → create a schedule { frequency, recipients[], label? }
//   DELETE → delete by ?schedule_id=...

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase'
import { asUntyped } from '@/lib/supabase-untyped'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess, requireBrandRole } from '@/lib/authorize'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

const createSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  recipients: z.array(z.string().email()).min(1).max(20),
  label: z.string().max(120).optional(),
})

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params

  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const brand = await verifyBrandAccess(id, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  try {
    const { data, error } = await asUntyped(db)
      .from('report_schedules')
      .select(
        'id, brand_id, frequency, recipients, label, is_active, next_run_at, last_sent_at, last_error, send_count, created_at',
      )
      .eq('brand_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      if (/report_schedules/i.test(error.message || '')) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Report schedules table not present — apply migration 20260527000000_report_schedules.sql.',
            code: 'SCHEDULES_MIGRATION_PENDING',
          },
          { status: 503 },
        )
      }
      throw new Error(error.message)
    }

    return NextResponse.json({ success: true, data: data ?? [], timestamp: Date.now() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.warn('report-schedules GET failed', { brandId: id, err: msg })
    return err('Failed to load report schedules')
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params

  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  // Creating a schedule persists a row and later emails recipients brand data,
  // so it is a write on the brand and takes editor rights — matching DELETE.
  const gate = await requireBrandRole(id, userId, 'editor')
  if ('response' in gate) return gate.response

  const ip = getClientIp(req.headers)
  const rate = await checkRateLimit(`report-schedules-post:${ip}`, 10, 60_000)
  if (!rate.success) return err('Rate limit exceeded', 429)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  try {
    const { data, error } = await asUntyped(db)
      .from('report_schedules')
      .insert({
        user_id: userId,
        brand_id: id,
        frequency: parsed.data.frequency,
        recipients: parsed.data.recipients,
        label: parsed.data.label ?? null,
      })
      .select(
        'id, brand_id, frequency, recipients, label, is_active, next_run_at, last_sent_at, last_error, send_count, created_at',
      )
      .single()

    if (error) {
      if (/report_schedules/i.test(error.message || '')) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Report schedules table not present — apply migration 20260527000000_report_schedules.sql.',
            code: 'SCHEDULES_MIGRATION_PENDING',
          },
          { status: 503 },
        )
      }
      throw new Error(error.message)
    }

    return NextResponse.json({ success: true, data, timestamp: Date.now() }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.warn('report-schedules POST failed', { brandId: id, err: msg })
    return err('Failed to create report schedule')
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params

  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  // Deleting a schedule is a write on the brand, and the schedule belongs to
  // the brand rather than to whoever set it up.
  const gate = await requireBrandRole(id, userId, 'editor')
  if ('response' in gate) return gate.response

  const scheduleId = req.nextUrl.searchParams.get('schedule_id')
  if (!scheduleId) return err('schedule_id query param required', 400)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  try {
    const { error } = await asUntyped(db)
      .from('report_schedules')
      .delete()
      .eq('id', scheduleId)
      .eq('brand_id', id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true, timestamp: Date.now() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return err(msg)
  }
}
