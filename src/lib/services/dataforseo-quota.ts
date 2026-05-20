// PATH: src/lib/services/dataforseo-quota.ts
//
// DataForSEO usage tracking + spending cap helper.
//
// Per the v2 API strategy (memory/project_api_strategy.md), DFS is the
// narrow-scope provider for Google AI Overview, Knowledge Graph, Google
// PAA, and keyword volume. To enforce the $20/mo dashboard spending cap
// and prevent silent scope creep, every DFS call should be wrapped by
// trackDataforseoCall() — see usage in serp-tracker.ts and dataforseo-paa.ts.

import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

// Default cap in cents. Mirrors the $20/mo dashboard cap from the strategy
// memo. Override via DATAFORSEO_MONTHLY_CAP_CENTS (e.g. 3000 = $30).
const DEFAULT_MONTHLY_CAP_CENTS = 2000

function getCapCents(): number {
  const raw = process.env['DATAFORSEO_MONTHLY_CAP_CENTS']
  const parsed = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MONTHLY_CAP_CENTS
}

function currentMonth(): string {
  const d = new Date()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${d.getUTCFullYear()}-${m}`
}

export interface DataforseoQuota {
  count: number
  costCents: number
  capCents: number
  remainingCents: number
  /** Fraction of cap consumed, 0-1. */
  utilization: number
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// dataforseo_usage table accessed at the boundary — same pattern as
// serpapi.ts / brave-search.ts. Generated Database type doesn't include it.

export async function getDataforseoQuota(): Promise<DataforseoQuota> {
  const capCents = getCapCents()
  const db = createServerClient() as any
  if (!db) {
    return {
      count: 0,
      costCents: 0,
      capCents,
      remainingCents: capCents,
      utilization: 0,
    }
  }
  const { data } = await db
    .from('dataforseo_usage')
    .select('count, cost_cents')
    .eq('month', currentMonth())
    .eq('key_index', 0)
    .maybeSingle()

  const count = (data?.count as number | undefined) ?? 0
  const costCents = (data?.cost_cents as number | undefined) ?? 0
  const remainingCents = Math.max(0, capCents - costCents)
  return {
    count,
    costCents,
    capCents,
    remainingCents,
    utilization: capCents > 0 ? costCents / capCents : 0,
  }
}

export class DataforseoCapExceeded extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'DataforseoCapExceeded'
  }
}

/**
 * Refuse the call if running the next request would exceed the monthly cap.
 * Pass the estimated cost of the next call in cents (0 to skip the check).
 * Throws DataforseoCapExceeded — caller handles graceful degradation.
 */
export async function assertCapAvailable(estimatedCostCents: number): Promise<void> {
  if (estimatedCostCents <= 0) return
  const { costCents, capCents } = await getDataforseoQuota()
  if (costCents + estimatedCostCents > capCents) {
    throw new DataforseoCapExceeded(
      `DataForSEO monthly cap would be exceeded (${costCents + estimatedCostCents}/${capCents} cents). ` +
        `Edit DATAFORSEO_MONTHLY_CAP_CENTS or wait until ${nextMonthLabel()}.`,
    )
  }
}

function nextMonthLabel(): string {
  const d = new Date()
  d.setUTCMonth(d.getUTCMonth() + 1)
  d.setUTCDate(1)
  return d.toISOString().slice(0, 10)
}

/**
 * Record a DFS call against the monthly counter + cost ledger.
 * Pass costCents = 0 for free/pre-paid endpoints; pass the actual amount
 * (rounded up) for billable calls. Never throws — failure to record is
 * a soft warn so the actual user-facing operation continues.
 */
export async function recordDataforseoCall(costCents: number): Promise<void> {
  const db = createServerClient() as any
  if (!db) return
  try {
    await db.rpc('increment_dataforseo_usage', {
      p_month: currentMonth(),
      p_key_index: 0,
      p_cost_cents: Math.max(0, Math.round(costCents)),
    })
  } catch (err) {
    logger.warn('DataForSEO usage increment failed', {
      service: 'dataforseo-quota',
      err: String(err),
    })
  }
}

/**
 * Convenience wrapper: cap-check, run the call, record on success.
 * Use for the "I want spending discipline without thinking about it" path.
 *
 * Example:
 *   const aio = await withDataforseoQuota(50, () => fetchGoogleAIOverview(q))
 */
export async function withDataforseoQuota<T>(
  estimatedCostCents: number,
  call: () => Promise<T>,
): Promise<T> {
  await assertCapAvailable(estimatedCostCents)
  const result = await call()
  await recordDataforseoCall(estimatedCostCents)
  return result
}
