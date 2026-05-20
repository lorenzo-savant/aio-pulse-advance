// PATH: src/lib/services/api-spending-monitor.ts
//
// Cross-provider SERP API spending + quota snapshot.
//
// Reads from brave_api_usage and dataforseo_usage and produces a single
// shape the operator dashboard can render. This is the "do I need to worry
// about API costs this month?" header widget.
//
// Why a separate service (vs reading both quotas inline from the dashboard):
//   - Sums utilization across providers to a single "spending health"
//     grade, so we don't have to teach the UI provider-specific business
//     rules ("DFS uses cents, Brave uses request count").
//   - Centralizes the alerting threshold (80% utilization → warn,
//     95% → critical) so the same gate fires for dashboards, webhooks,
//     and cron jobs without duplicating constants.

import { getBraveQuota } from './brave-search'
import { getDataforseoQuota } from './dataforseo-quota'

export type SpendingGrade = 'healthy' | 'warning' | 'critical'

export interface ProviderSnapshot {
  provider: 'brave' | 'dataforseo'
  /** Human-readable utilization line for the dashboard. */
  label: string
  /** Fraction of cap consumed, 0-1 (NaN safe). */
  utilization: number
  /** Currency cost in cents (0 if N/A, e.g. Brave free tier). */
  costCents: number
  /** Whether the provider is configured at all. */
  configured: boolean
  /** Whether we still have headroom for a new request. */
  remaining: boolean
}

export interface SpendingSnapshot {
  grade: SpendingGrade
  /** Combined utilization across providers (max of components — the worst
   *  offender drives the grade, not the average, because a single provider
   *  hitting 100% is enough to break a workflow.) */
  utilization: number
  /** Total month-to-date spend in cents. */
  totalCostCents: number
  providers: ProviderSnapshot[]
  /** Operator advice string, ready to render. */
  advice: string
}

const WARN_THRESHOLD = 0.8
const CRITICAL_THRESHOLD = 0.95

function gradeFor(utilization: number): SpendingGrade {
  if (!Number.isFinite(utilization)) return 'healthy'
  if (utilization >= CRITICAL_THRESHOLD) return 'critical'
  if (utilization >= WARN_THRESHOLD) return 'warning'
  return 'healthy'
}

function adviceFor(grade: SpendingGrade, providers: ProviderSnapshot[]): string {
  if (grade === 'critical') {
    const offenders = providers
      .filter((p) => p.utilization >= CRITICAL_THRESHOLD)
      .map((p) => p.provider)
      .join(', ')
    return `Critical: ${offenders} near cap — new SERP requests will start failing. Raise the cap or wait for the month rollover.`
  }
  if (grade === 'warning') {
    return 'Warning: SERP spend above 80% of cap. Consider increasing cache TTL or raising the monthly cap before requests start being refused.'
  }
  return 'Healthy: SERP API spending within budget.'
}

export async function getSpendingSnapshot(): Promise<SpendingSnapshot> {
  const [brave, dfs] = await Promise.all([getBraveQuota(), getDataforseoQuota()])

  const braveConfigured = brave.limit > 0
  const braveUtil = braveConfigured ? brave.used / brave.limit : 0
  const braveSnap: ProviderSnapshot = {
    provider: 'brave',
    label: braveConfigured ? `${brave.used} / ${brave.limit} requests` : 'Brave not configured',
    utilization: braveUtil,
    costCents: 0, // Brave free tier — no $ cost surfaced from this provider
    configured: braveConfigured,
    remaining: brave.remaining > 0,
  }

  const dfsConfigured = dfs.capCents > 0
  const dfsSnap: ProviderSnapshot = {
    provider: 'dataforseo',
    label: dfsConfigured
      ? `$${(dfs.costCents / 100).toFixed(2)} / $${(dfs.capCents / 100).toFixed(2)} (${dfs.count} calls)`
      : 'DataForSEO not configured',
    utilization: dfs.utilization,
    costCents: dfs.costCents,
    configured: dfsConfigured,
    remaining: dfs.remainingCents > 0,
  }

  const providers = [braveSnap, dfsSnap]
  const utilization = Math.max(braveUtil, dfs.utilization)
  const grade = gradeFor(utilization)
  return {
    grade,
    utilization,
    totalCostCents: providers.reduce((a, p) => a + p.costCents, 0),
    providers,
    advice: adviceFor(grade, providers),
  }
}
