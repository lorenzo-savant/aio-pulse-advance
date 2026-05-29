// PATH: src/lib/services/geo-score-precompute.ts
//
// GEO Score precompute — the writer half of the GEO Score system.
//
// /api/geo-score (the reader) recomputes scores on the fly from
// brand_health_scores. This file snapshots the result into
// geo_score_snapshots so we have a persistent time-series that supports:
//
//   1. Cheap history reads (no formula re-run per row)
//   2. Alert evaluation (compare today vs yesterday persistently)
//   3. Bulk re-scoring (backfill N days when the formula changes)
//
// Triggered by /api/cron/geo-analysis (scheduled weekly + on-demand).
// All writes use the service-role client because the cron is not running
// as any specific user.

import { createServerClient } from '@/lib/supabase'
import { calculateGeoScore, type GeoScoreInput, type GeoScoreResult } from './geo-score'
import { loadLatestSiteAuditSummary } from './site-audit-summary'
import { sampleConfidence } from './confidence'
import { dispatchAlert } from './alerts'
import { logger } from '@/lib/logger'
import type { AlertEvent, AlertRule, Brand } from '@/types'

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Alert thresholds ────────────────────────────────────────────────────────
// Defaults — overridable by AlertRule.condition.threshold per-rule.

/** Default threshold (delta points) below which a `geo_score_drop` fires. */
const DEFAULT_DROP_THRESHOLD = 10

/** Default absolute score threshold below which `geo_score_critical` fires. */
const DEFAULT_CRITICAL_THRESHOLD = 60

// ─── Public types ────────────────────────────────────────────────────────────

export interface SnapshotResult {
  brandId: string
  brandName: string
  snapshotDate: string
  score: number
  previousScore: number | null
  delta: number | null
  triggeredAlerts: ('geo_score_drop' | 'geo_score_critical')[]
  inserted: boolean
}

export interface PrecomputeRunReport {
  processed: number
  succeeded: number
  failed: number
  alertsDispatched: number
  snapshots: SnapshotResult[]
  errors: Array<{ brandId: string; error: string }>
}

// ─── Internal helpers ────────────────────────────────────────────────────────

interface HealthRow {
  date: string
  citation_rate?: number | null
  mention_rate?: number | null
  visibility_score?: number | null
  recommendation_rate?: number | null
  sentiment_score?: number | null
  position_avg?: number | null
  hallucination_rate?: number | null
  engine_breakdown?: unknown
}

/** Mirrors the toInput() helper in /api/geo-score so the math is identical. */
function toInput(row: HealthRow): GeoScoreInput {
  return {
    citationRate: row.citation_rate ?? null,
    mentionRate: row.mention_rate ?? row.visibility_score ?? null,
    recommendationRate: row.recommendation_rate ?? null,
    sentimentScore: row.sentiment_score ?? null,
    positionAvg: row.position_avg ?? null,
    hallucinationRate: row.hallucination_rate ?? null,
  }
}

function parseEngineBreakdown(raw: unknown): Record<string, number> {
  let obj: unknown = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return {}
    }
  }
  if (!obj || typeof obj !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const n = Number(v)
    if (Number.isFinite(n)) out[k] = n
  }
  return out
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]!
}

function dateOffsetISO(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() - offsetDays)
  return d.toISOString().split('T')[0]!
}

// ─── Health-row loader ───────────────────────────────────────────────────────

async function loadHealthRow(
  db: NonNullable<ReturnType<typeof createServerClient>>,
  brandId: string,
  beforeDate: string,
): Promise<HealthRow | null> {
  const { data, error } = await (db as any)
    .from('brand_health_scores')
    .select(
      'date, citation_rate, mention_rate, visibility_score, recommendation_rate, sentiment_score, position_avg, hallucination_rate, engine_breakdown',
    )
    .eq('brand_id', brandId)
    .lte('date', beforeDate)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return data as HealthRow
}

// ─── Snapshot writer ─────────────────────────────────────────────────────────

async function upsertSnapshot(
  db: NonNullable<ReturnType<typeof createServerClient>>,
  brandId: string,
  snapshotDate: string,
  scoreResult: GeoScoreResult,
  health: HealthRow,
  sampleSize: number,
  previousScore: number | null,
): Promise<boolean> {
  const delta = previousScore != null ? scoreResult.score - previousScore : null

  const { error } = await (db as any).from('geo_score_snapshots').upsert(
    {
      brand_id: brandId,
      snapshot_date: snapshotDate,
      score: scoreResult.score,
      grade: scoreResult.grade,
      pillars: scoreResult.pillars,
      recommendations: scoreResult.recommendations,
      engine_breakdown: parseEngineBreakdown(health.engine_breakdown),
      sample_size: sampleSize,
      confidence: sampleConfidence(sampleSize),
      previous_score: previousScore,
      delta,
      triggered_alerts: [],
    },
    { onConflict: 'brand_id,snapshot_date' },
  )

  if (error) {
    logger.error('geo-score-precompute upsert failed', {
      service: 'geo-precompute',
      brandId,
      snapshotDate,
      err: error,
    })
    return false
  }
  return true
}

// ─── Alert dispatch ──────────────────────────────────────────────────────────
//
// We look for AlertRule rows with type `geo_score_drop` / `geo_score_critical`
// on this brand and dispatch via the same channel pipeline used by the
// monitoring cron. No rule → no notification, just an audit-log entry on the
// snapshot row (triggered_alerts column).
//
// `dispatchAlert` already handles email + webhook + HMAC signing + retry
// (see src/lib/services/alerts.ts) so we don't reimplement any of that.

async function evaluateAndDispatchAlerts(
  db: NonNullable<ReturnType<typeof createServerClient>>,
  brand: Brand,
  score: number,
  previousScore: number | null,
  snapshotDate: string,
): Promise<('geo_score_drop' | 'geo_score_critical')[]> {
  const delta = previousScore != null ? score - previousScore : 0

  const { data: rulesRaw } = await (db as any)
    .from('alert_rules')
    .select('*')
    .eq('brand_id', brand.id)
    .eq('is_active', true)
    .in('type', ['geo_score_drop', 'geo_score_critical'])
  const rules = (rulesRaw ?? []) as AlertRule[]

  const triggered: ('geo_score_drop' | 'geo_score_critical')[] = []

  for (const rule of rules) {
    let shouldFire = false
    let title = ''
    let description = ''

    if (rule.type === 'geo_score_critical') {
      const threshold = rule.condition?.threshold ?? DEFAULT_CRITICAL_THRESHOLD
      shouldFire = score < threshold
      title = `GEO Score critical: ${score.toFixed(1)} < ${threshold}`
      description = `${brand.name}'s GEO Score has fallen below the critical threshold. Open the dashboard for the top-priority recommendations.`
    } else if (rule.type === 'geo_score_drop') {
      const threshold = rule.condition?.threshold ?? DEFAULT_DROP_THRESHOLD
      shouldFire = previousScore != null && -delta >= threshold
      title = `GEO Score dropped ${(-delta).toFixed(1)} pts (${previousScore?.toFixed(1)} → ${score.toFixed(1)})`
      description = `${brand.name}'s GEO Score dropped sharply vs the previous snapshot. Review the pillar breakdown to spot which signal regressed.`
    }

    if (!shouldFire) continue

    const event: AlertEvent = {
      id: crypto.randomUUID(),
      alert_rule_id: rule.id,
      brand_id: brand.id,
      user_id: rule.user_id,
      type: rule.type,
      title,
      message: description,
      data: {
        score,
        previous_score: previousScore,
        delta,
        snapshot_date: snapshotDate,
      },
      channels_sent: [],
      is_read: false,
      created_at: new Date().toISOString(),
    }

    try {
      const channels = await dispatchAlert(event, rule, brand)
      logger.info('GEO score alert dispatched', {
        service: 'geo-precompute',
        brandId: brand.id,
        type: rule.type,
        channels,
      })
      // Narrow back to the two GEO alert types — the alert_rules query above
      // already filters `.in('type', ['geo_score_drop','geo_score_critical'])`,
      // so this cast is safe and just satisfies the wider AlertType union.
      triggered.push(rule.type as 'geo_score_drop' | 'geo_score_critical')
    } catch (err) {
      logger.error('GEO score alert dispatch failed', {
        service: 'geo-precompute',
        brandId: brand.id,
        rule: rule.id,
        err,
      })
    }
  }

  if (triggered.length > 0) {
    await (db as any)
      .from('geo_score_snapshots')
      .update({ triggered_alerts: triggered })
      .eq('brand_id', brand.id)
      .eq('snapshot_date', snapshotDate)
  }

  return triggered
}

// ─── Single-brand path ──────────────────────────────────────────────────────

export async function precomputeGeoSnapshotForBrand(
  brand: Brand,
  options: { date?: string } = {},
): Promise<SnapshotResult | { brandId: string; error: string }> {
  const db = createServerClient()
  if (!db) return { brandId: brand.id, error: 'Database not configured' }

  const snapshotDate = options.date ?? todayISO()

  try {
    // Today's row + yesterday's row (delta source). loadLatestSiteAuditSummary
    // is left in for parity with /api/geo-score even though the snapshot
    // doesn't persist its full output — the GEO Score result already folds
    // in audit signals via brand_health_scores.
    const [health, previousHealth] = await Promise.all([
      loadHealthRow(db, brand.id, snapshotDate),
      loadHealthRow(db, brand.id, dateOffsetISO(1)),
    ])

    if (!health) {
      return {
        brandId: brand.id,
        error: `No brand_health_scores row on or before ${snapshotDate}`,
      }
    }

    await loadLatestSiteAuditSummary(brand.id) // side-effect: warm cache if present

    const scoreResult = calculateGeoScore(toInput(health))
    const previousScore = previousHealth ? calculateGeoScore(toInput(previousHealth)).score : null

    // Sample size for confidence label — count monitoring_results in window.
    const startWindow = dateOffsetISO(30)
    const { count: sampleCount } = await (db as any)
      .from('monitoring_results')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand.id)
      .gte('created_at', `${startWindow}T00:00:00.000Z`)
    const sampleSize = sampleCount ?? 0

    const inserted = await upsertSnapshot(
      db,
      brand.id,
      snapshotDate,
      scoreResult,
      health,
      sampleSize,
      previousScore,
    )

    if (!inserted) {
      return { brandId: brand.id, error: 'Failed to upsert snapshot' }
    }

    // Alert evaluation happens after the snapshot is durable so a failed
    // dispatch doesn't leave the snapshot un-persisted on retry.
    const triggered = await evaluateAndDispatchAlerts(
      db,
      brand,
      scoreResult.score,
      previousScore,
      snapshotDate,
    )

    return {
      brandId: brand.id,
      brandName: brand.name,
      snapshotDate,
      score: scoreResult.score,
      previousScore,
      delta: previousScore != null ? scoreResult.score - previousScore : null,
      triggeredAlerts: triggered,
      inserted: true,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('precomputeGeoSnapshotForBrand failed', {
      service: 'geo-precompute',
      brandId: brand.id,
      err: msg,
    })
    return { brandId: brand.id, error: msg }
  }
}

// ─── All-brands path ─────────────────────────────────────────────────────────

export async function precomputeAllGeoSnapshots(
  options: { date?: string } = {},
): Promise<PrecomputeRunReport> {
  const db = createServerClient()
  if (!db) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      alertsDispatched: 0,
      snapshots: [],
      errors: [{ brandId: '*', error: 'Database not configured' }],
    }
  }

  const { data: brandsRaw, error } = await (db as any).from('brands').select('*')
  if (error || !brandsRaw) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      alertsDispatched: 0,
      snapshots: [],
      errors: [{ brandId: '*', error: error?.message ?? 'No brands loaded' }],
    }
  }
  const brands = brandsRaw as Brand[]

  const report: PrecomputeRunReport = {
    processed: brands.length,
    succeeded: 0,
    failed: 0,
    alertsDispatched: 0,
    snapshots: [],
    errors: [],
  }

  // Process brands SEQUENTIALLY (not parallel) — keeps Supabase pool happy
  // and avoids Resend rate-limit spikes if many brands cross alert thresholds
  // on the same run. For 100+ brands consider a worker pool of 3–5.
  for (const brand of brands) {
    const result = await precomputeGeoSnapshotForBrand(brand, options)
    if ('error' in result) {
      report.failed++
      report.errors.push({ brandId: result.brandId, error: result.error })
    } else {
      report.succeeded++
      report.alertsDispatched += result.triggeredAlerts.length
      report.snapshots.push(result)
    }
  }

  logger.info('GEO precompute run complete', {
    service: 'geo-precompute',
    processed: report.processed,
    succeeded: report.succeeded,
    failed: report.failed,
    alertsDispatched: report.alertsDispatched,
  })

  return report
}

// ─── Backfill path ───────────────────────────────────────────────────────────
//
// Re-computes snapshots for the last `days` days for every brand. Used when
// the GEO formula changes (weights, new pillar) and existing snapshot rows
// need to reflect the new math. Idempotent thanks to the unique constraint
// + upsert.

export async function backfillGeoSnapshots(
  days: number,
): Promise<{ daysProcessed: number; runs: PrecomputeRunReport[] }> {
  const safeDays = Math.max(1, Math.min(days, 90))
  const runs: PrecomputeRunReport[] = []

  for (let offset = 0; offset < safeDays; offset++) {
    const date = dateOffsetISO(offset)
    const report = await precomputeAllGeoSnapshots({ date })
    runs.push(report)
  }

  return { daysProcessed: safeDays, runs }
}
