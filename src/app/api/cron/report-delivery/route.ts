// PATH: src/app/api/cron/report-delivery/route.ts
//
// Cron-driven scheduled-report delivery. Sweeps report_schedules for
// rows where next_run_at is due, generates a white-label PDF using the
// existing pdf-generator, emails it to the schedule's recipients via
// Resend, and advances next_run_at by the cadence interval.
//
// Hits the same /api/cron/{monitoring,weekly-review} auth pattern so
// deploy behaviour stays consistent: trigger via Vercel cron / GitHub
// Actions / external scheduler with CRON_SECRET header.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { asUntyped } from '@/lib/supabase-untyped'
import { verifyCronAuth } from '@/lib/cron-auth'
import { generatePdf } from '@/lib/services/pdf-generator'
import { sendScheduledReportEmail } from '@/lib/services/email'
import { logger } from '@/lib/logger'
import type { Brand } from '@/types'

export const dynamic = 'force-dynamic'

interface ScheduleRow {
  id: string
  user_id: string
  brand_id: string
  frequency: 'daily' | 'weekly' | 'monthly'
  recipients: string[]
  label: string | null
  next_run_at: string
}

/** Roll next_run_at forward by the cadence.
 *
 * IMPORTANT: arithmetic is UTC. The cron sweep itself runs on whatever
 * schedule the trigger fires (Vercel cron / GH Actions / etc) so a
 * weekly schedule created at 09:00 CET will fire at 09:00 UTC + 7d
 * intervals — i.e. delivery time will drift relative to the operator's
 * local time across daylight savings, and "every Monday" reads as
 * "every Monday in UTC" not "every Monday in your timezone".
 *
 * Operators in CET/CEST see delivery at 10:00 (winter) / 11:00 (summer)
 * when the row was created at 10:00 winter. If that becomes a real
 * complaint, the migration needs an optional `tz` column and this
 * function needs to accept it. Mythos audit, May 2026. */
function nextRunAfter(now: Date, frequency: ScheduleRow['frequency']): Date {
  const d = new Date(now)
  if (frequency === 'daily') d.setUTCDate(d.getUTCDate() + 1)
  else if (frequency === 'weekly') d.setUTCDate(d.getUTCDate() + 7)
  else if (frequency === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1)
  return d
}

export async function POST(req: NextRequest) {
  const cronError = verifyCronAuth(req)
  if (cronError) return cronError

  const db = createServerClient()
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const dbAny = asUntyped(db)

  // 1. Pick up to 25 due schedules per tick. Larger batches risk
  //    blowing the request timeout (each delivery is ~1-3s of PDF gen
  //    + 0.5-2s of email send).
  const nowIso = new Date().toISOString()
  const { data: schedules, error: scheduleErr } = await dbAny
    .from('report_schedules')
    .select('id, user_id, brand_id, frequency, recipients, label, next_run_at')
    .eq('is_active', true)
    .lte('next_run_at', nowIso)
    .order('next_run_at', { ascending: true })
    .limit(25)

  if (scheduleErr) {
    logger.error('report-delivery: failed to load schedules', { err: scheduleErr.message })
    return NextResponse.json({ error: scheduleErr.message }, { status: 500 })
  }

  const due = (schedules ?? []) as ScheduleRow[]
  if (due.length === 0) {
    return NextResponse.json({ message: 'No schedules due', delivered: 0 })
  }

  const results: Array<{
    id: string
    brand_id: string
    success: boolean
    error?: string
    recipients?: number
  }> = []

  for (const sched of due) {
    try {
      if (!sched.recipients || sched.recipients.length === 0) {
        throw new Error('Schedule has no recipients')
      }

      // 2. Load brand + monitoring data for the last 30 days. Mirrors
      //    the /api/reports/pdf data shape so the existing PDF generator
      //    works unchanged.
      const { data: brand, error: brandErr } = await dbAny
        .from('brands')
        .select('*')
        .eq('id', sched.brand_id)
        .single()
      if (brandErr || !brand) throw new Error(brandErr?.message || 'Brand not found')

      const toDate = new Date().toISOString().split('T')[0]!
      const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!

      const { data: monRows } = await dbAny
        .from('monitoring_results')
        .select('*, prompt:prompts(text, category)')
        .eq('brand_id', sched.brand_id)
        .gte('created_at', fromDate)
        .lte('created_at', `${toDate}T23:59:59`)
        .order('created_at', { ascending: false })

      const { data: recommendations } = await dbAny
        .from('recommendation_tracking')
        .select('recommendation_text, priority, category')
        .eq('brand_id', sched.brand_id)
        .eq('status', 'active')
        .order('priority', { ascending: false })
        .limit(10)

      const brandData: Brand = {
        id: brand.id,
        user_id: brand.user_id ?? sched.user_id,
        name: brand.name,
        slug: brand.slug,
        description: brand.description,
        domain: brand.domain,
        aliases: brand.aliases ?? [],
        domains: brand.domain ? [brand.domain] : [],
        competitors: brand.competitors ?? [],
        industry: brand.industry,
        color: brand.color || '#6366f1',
        logo_url: brand.logo_url,
        is_active: brand.is_active ?? true,
        created_at: brand.created_at || new Date().toISOString(),
        updated_at: brand.updated_at || new Date().toISOString(),
        language: (brand.language as 'en' | 'it' | 'sv') || 'en',
        report_logo_url: brand.report_logo_url,
        report_brand_name: brand.report_brand_name,
        report_primary_color: brand.report_primary_color,
      } as Brand

      const pdfBuffer = await generatePdf(
        brandData,
        {
          brandName: brand.name || 'Brand',
          fromDate,
          toDate,
          results: (monRows ?? []).map((r: Record<string, unknown>) => ({
            created_at: String(r.created_at ?? ''),
            engine: String(r.engine ?? ''),
            brand_mentioned: Boolean(r.brand_mentioned),
            visibility_score: Number(r.visibility_score ?? 0),
            sentiment: (r.sentiment as string | null) ?? null,
            sentiment_score: (r.sentiment_score as number | null) ?? null,
            url: (r.url as string | null) ?? null,
            cited_urls: (r.cited_urls as string[]) ?? [],
            has_hallucination: Boolean(r.has_hallucination),
            competitor_mentions:
              (r.competitor_mentions as Array<{
                name: string
                position: number
                count: number
              }>) ?? [],
          })),
          recommendations: (recommendations ?? []).map((r: Record<string, unknown>) => ({
            recommendation_text: String(r.recommendation_text ?? ''),
            priority: (r.priority as string | null) ?? null,
            category: (r.category as string | null) ?? null,
          })),
          competitors: brand.competitors ?? [],
        },
        { locale: brand.language ?? 'en' },
      )

      const sendRes = await sendScheduledReportEmail({
        to: sched.recipients,
        brandName: brand.name ?? 'Brand',
        fromDate,
        toDate,
        pdfBuffer,
        label: sched.label,
      })

      if (!sendRes.success) {
        throw new Error(sendRes.error || 'Email send failed')
      }

      // 3. Advance next_run_at + log success. supabase-js doesn't
      //    support inline arithmetic on update(), so we fetch + increment
      //    + write back. Cheap because we already have the row's id.
      const next = nextRunAfter(new Date(), sched.frequency)
      const { data: current } = await dbAny
        .from('report_schedules')
        .select('send_count')
        .eq('id', sched.id)
        .single()
      const nextSendCount = ((current?.send_count as number | undefined) ?? 0) + 1
      await dbAny
        .from('report_schedules')
        .update({
          last_sent_at: new Date().toISOString(),
          next_run_at: next.toISOString(),
          last_error: null,
          send_count: nextSendCount,
        })
        .eq('id', sched.id)

      results.push({
        id: sched.id,
        brand_id: sched.brand_id,
        success: true,
        recipients: sched.recipients.length,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      logger.warn('report-delivery: schedule failed', {
        schedule_id: sched.id,
        brand_id: sched.brand_id,
        err: message,
      })
      // Record the error but DON'T advance next_run_at — let the next
      // cron tick retry. Operator sees last_error in the schedule UI.
      await dbAny
        .from('report_schedules')
        .update({ last_error: message.slice(0, 500) })
        .eq('id', sched.id)
      results.push({ id: sched.id, brand_id: sched.brand_id, success: false, error: message })
    }
  }

  const delivered = results.filter((r) => r.success).length
  return NextResponse.json({
    success: true,
    scanned: due.length,
    delivered,
    failed: due.length - delivered,
    results,
  })
}
