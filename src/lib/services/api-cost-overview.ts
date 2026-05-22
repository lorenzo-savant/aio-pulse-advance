// PATH: src/lib/services/api-cost-overview.ts
//
// Unified API cost overview — aggregates EVERY paid surface the platform
// touches into a single snapshot for the operator dashboard:
//
//   - SERP providers: Brave (free tier counts + paid spend), DataForSEO
//     (pay-as-you-go in cents), SerpApi (legacy, still counted if rows
//     exist in serpapi_usage from before the v2.2.0 removal).
//   - AI providers: aggregated from ai_cost_logs (gemini, openai, claude,
//     groq, perplexity, etc.) for the current month — costs come from
//     the writer that records per-call cost_usd at log time.
//   - Credits ledger: purchased / used / balance from credits +
//     credit_usage tables.
//
// Why a separate service from api-spending-monitor.ts:
//   - spending-monitor is the cap/health gate used by withDataforseoQuota
//     and friends; it's about "are we about to break"?
//   - cost-overview is the operator panel that surfaces $ amounts +
//     historical context. Different consumer, different granularity.
//
// The whole snapshot is read-only and cheap (≤4 small Supabase queries
// in parallel) so it's safe to call on every page load.

import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getSpendingSnapshot } from './api-spending-monitor'

export interface SerpProviderSnapshot {
  provider: 'brave' | 'dataforseo' | 'serpapi'
  configured: boolean
  /** Number of API calls billed in the current month. */
  calls: number
  /** $ spent this month in cents. 0 for free-tier providers like Brave. */
  costCents: number
  /**
   * $ spent this month as a full-precision float (USD). Carried alongside
   * costCents because sub-cent per-call costs accumulate to a meaningful
   * total that integer cents would floor away.
   */
  costUsd: number
  /** Monthly cap in cents (DFS) or call count (Brave/SerpApi). null if uncapped. */
  capCents: number | null
  capCalls: number | null
  /** Computed 0-1 utilization for the bar in the UI. */
  utilization: number
  /** Human-readable status line. */
  label: string
}

export interface AiProviderSnapshot {
  provider: string
  /** True when the matching API key is present in the environment. */
  configured: boolean
  calls: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costCents: number
  /**
   * Full-precision spend (USD float) before rounding to cents. ai_cost_logs
   * records float cost_usd per call; rounding each call to whole cents floors
   * sub-cent calls to 0, so we sum the float and round ONCE for display.
   */
  costUsd: number
}

// Canonical LLM providers we always surface on the cost dashboard, mapped to
// the env var that enables them. Listed even at $0 so operators can see which
// keys are configured (mirrors the SERP section's behavior).
const KNOWN_AI_PROVIDERS: Array<{ key: string; envVar: string }> = [
  { key: 'openai', envVar: 'OPENAI_API_KEY' },
  { key: 'gemini', envVar: 'GEMINI_API_KEY' },
  { key: 'anthropic', envVar: 'ANTHROPIC_API_KEY' },
  { key: 'perplexity', envVar: 'PERPLEXITY_API_KEY' },
  { key: 'groq', envVar: 'GROQ_API_KEY' },
]

// ai_cost_logs may record providers under aliases; fold them onto the
// canonical key so usage lands on the right row.
const PROVIDER_ALIASES: Record<string, string> = {
  chatgpt: 'openai',
  gpt: 'openai',
  'gpt-4o-mini': 'openai',
  claude: 'anthropic',
  google: 'gemini',
  'gemini-2.5-flash': 'gemini',
}

function canonicalProvider(raw: string): string {
  const key = raw.toLowerCase().trim()
  return PROVIDER_ALIASES[key] ?? key
}

export interface CreditsSnapshot {
  /** Total credits purchased (positive Credit rows). */
  purchased: number
  /** Total credits used (rows in credit_usage). */
  used: number
  /** Available balance (purchased - used). */
  balance: number
  /** Earliest expiry date among unexpired purchased credits. */
  earliestExpiry: string | null
}

export interface ApiCostOverview {
  /** YYYY-MM the snapshot covers. */
  month: string
  /** Grand total spend in cents (SERP + AI). Credits are a separate ledger. */
  totalSpendCents: number
  /** Grand total spend as a full-precision USD float (SERP + AI). */
  totalSpendUsd: number
  serp: {
    providers: SerpProviderSnapshot[]
    totalCostCents: number
    totalCostUsd: number
  }
  ai: {
    providers: AiProviderSnapshot[]
    totalCostCents: number
    totalCostUsd: number
  }
  credits: CreditsSnapshot
}

function currentMonth(): string {
  const d = new Date()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${d.getUTCFullYear()}-${m}`
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Raw usage tables aren't in the generated Database type; cast at boundary.

async function loadSerpSnapshot(): Promise<{
  providers: SerpProviderSnapshot[]
  totalCostCents: number
  totalCostUsd: number
}> {
  // Reuse the spending-monitor for Brave + DFS — same source of truth as
  // the cap-gate. Then add SerpApi separately since spending-monitor
  // intentionally ignores the legacy provider.
  const monitor = await getSpendingSnapshot()

  const providers: SerpProviderSnapshot[] = monitor.providers.map((p) => {
    if (p.provider === 'brave') {
      // Brave is free-tier 2k/mo; the "cap" is a call count not cents.
      // Extract usage / limit out of the label which is "USED / LIMIT requests".
      const match = /([\d,]+)\s*\/\s*([\d,]+)/.exec(p.label)
      const used = match ? parseInt((match[1] ?? '0').replace(/,/g, ''), 10) : 0
      const limit = match ? parseInt((match[2] ?? '0').replace(/,/g, ''), 10) : 0
      return {
        provider: 'brave',
        configured: p.configured,
        calls: used,
        costCents: 0,
        costUsd: 0,
        capCents: null,
        capCalls: limit > 0 ? limit : null,
        utilization: p.utilization,
        label: p.label,
      }
    }
    // DataForSEO — initialize with monitor-supplied utilization but leave
    // calls + capCents to be hydrated from the actual dataforseo_usage row
    // below. We start capCents at the env-default ($20) so it's correct
    // even if the row query soft-fails; the hydrate step then overwrites
    // with the live value when available.
    const capRaw = process.env['DATAFORSEO_MONTHLY_CAP_CENTS']
    const capParsed = capRaw ? parseInt(capRaw, 10) : NaN
    const defaultCapCents = Number.isFinite(capParsed) && capParsed > 0 ? capParsed : 2000
    return {
      provider: 'dataforseo',
      configured: p.configured,
      calls: 0,
      costCents: p.costCents,
      costUsd: p.costCents / 100,
      capCents: defaultCapCents,
      capCalls: null,
      utilization: p.utilization,
      label: p.label,
    }
  })

  // Pull the DFS row directly to get accurate count + capCents (the
  // monitor only exposes label strings — for the overview we want the
  // raw numbers without re-parsing).
  const db = createServerClient() as any
  if (db) {
    try {
      const { data: dfsRow } = await db
        .from('dataforseo_usage')
        .select('count, cost_cents')
        .eq('month', currentMonth())
        .eq('key_index', 0)
        .maybeSingle()
      const dfsProvider = providers.find((p) => p.provider === 'dataforseo')
      if (dfsProvider) {
        dfsProvider.calls = (dfsRow?.count as number | undefined) ?? 0
        dfsProvider.costCents = (dfsRow?.cost_cents as number | undefined) ?? 0
        // capCents was seeded above from env default — DFS row never
        // contains the cap, so no override needed here.
      }
    } catch (err) {
      logger.warn('api-cost-overview: dataforseo hydrate failed', { err: String(err) })
    }

    // SerpApi (legacy). If the table has any rows this month, surface them
    // so operators can see leftover cost from the pre-v2.2.0 setup. Soft-
    // fail if the table was dropped.
    try {
      const { data: serpRow } = await db
        .from('serpapi_usage')
        .select('count, cost_cents')
        .eq('month', currentMonth())
        .maybeSingle()
      if (serpRow) {
        providers.push({
          provider: 'serpapi',
          configured: true, // present in DB means it was configured at some point
          calls: (serpRow.count as number | undefined) ?? 0,
          costCents: (serpRow.cost_cents as number | undefined) ?? 0,
          costUsd: ((serpRow.cost_cents as number | undefined) ?? 0) / 100,
          capCents: null,
          capCalls: null,
          utilization: 0,
          label: 'SerpApi (legacy — removed in v2.2.0)',
        })
      }
    } catch {
      /* serpapi_usage might be dropped — silent skip */
    }
  }

  // Sync costUsd from the (possibly hydrated) costCents so SERP figures stay
  // consistent across both units, then total in each.
  for (const p of providers) p.costUsd = p.costCents / 100
  const totalCostCents = providers.reduce((a, p) => a + p.costCents, 0)
  const totalCostUsd = providers.reduce((a, p) => a + p.costUsd, 0)
  return { providers, totalCostCents, totalCostUsd }
}

function emptyProvider(key: string): AiProviderSnapshot {
  return {
    provider: key,
    configured: !!process.env[KNOWN_AI_PROVIDERS.find((p) => p.key === key)?.envVar ?? ''],
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costCents: 0,
    costUsd: 0,
  }
}

async function loadAiSnapshot(userId: string): Promise<{
  providers: AiProviderSnapshot[]
  totalCostCents: number
  totalCostUsd: number
}> {
  // Seed with every known provider so the dashboard always lists Gemini,
  // OpenAI, Claude, Perplexity and Groq with their configured status — even
  // before any usage is logged. Usage from ai_cost_logs is overlaid below.
  const byProvider = new Map<string, AiProviderSnapshot>()
  for (const { key, envVar } of KNOWN_AI_PROVIDERS) {
    byProvider.set(key, { ...emptyProvider(key), configured: !!process.env[envVar] })
  }

  const db = createServerClient() as any

  if (db) {
    // Aggregate by provider for the current month.
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)

    try {
      const { data: rows } = await db
        .from('ai_cost_logs')
        .select('provider, input_tokens, output_tokens, total_tokens, cost_usd')
        .eq('user_id', userId)
        .gte('created_at', monthStart.toISOString())
        .limit(50000)

      for (const r of (rows ?? []) as Array<{
        provider: string | null
        input_tokens: number | null
        output_tokens: number | null
        total_tokens: number | null
        cost_usd: number | null
      }>) {
        const key = canonicalProvider(r.provider || 'unknown')
        const acc = byProvider.get(key) ?? emptyProvider(key)
        acc.calls += 1
        acc.inputTokens += r.input_tokens ?? 0
        acc.outputTokens += r.output_tokens ?? 0
        acc.totalTokens += r.total_tokens ?? 0
        // Accumulate the float USD; rounding each call to whole cents would
        // floor sub-cent calls to 0 and lose the accumulating total. We round
        // ONCE, after summing, below.
        acc.costUsd += r.cost_usd ?? 0
        byProvider.set(key, acc)
      }
    } catch (err) {
      logger.warn('api-cost-overview: ai_cost_logs read failed', { err: String(err) })
    }
  }

  // Round to whole cents ONCE, after summing the per-call floats.
  for (const p of byProvider.values()) p.costCents = Math.round(p.costUsd * 100)

  // Sort: spend desc, then configured-before-unconfigured, then name — so the
  // active/paid providers float to the top and known-but-idle keys still show.
  const providers = [...byProvider.values()].sort(
    (a, b) =>
      b.costUsd - a.costUsd ||
      Number(b.configured) - Number(a.configured) ||
      a.provider.localeCompare(b.provider),
  )
  const totalCostCents = providers.reduce((a, p) => a + p.costCents, 0)
  const totalCostUsd = providers.reduce((a, p) => a + p.costUsd, 0)
  return { providers, totalCostCents, totalCostUsd }
}

async function loadCreditsSnapshot(userId: string): Promise<CreditsSnapshot> {
  const db = createServerClient() as any
  if (!db) return { purchased: 0, used: 0, balance: 0, earliestExpiry: null }

  try {
    const [{ data: purchasedRows }, { data: usageRows }] = await Promise.all([
      db
        .from('credits')
        .select('amount, expires_at')
        .eq('user_id', userId)
        .gt('amount', 0)
        .limit(10000),
      db.from('credit_usage').select('credits_used').eq('user_id', userId).limit(50000),
    ])

    const purchased = ((purchasedRows ?? []) as Array<{ amount: number | null }>).reduce(
      (s, r) => s + (r.amount ?? 0),
      0,
    )
    const used = ((usageRows ?? []) as Array<{ credits_used: number | null }>).reduce(
      (s, r) => s + (r.credits_used ?? 0),
      0,
    )

    // Earliest expiry among purchased credits that haven't expired yet.
    const now = Date.now()
    const futureExpiries = ((purchasedRows ?? []) as Array<{ expires_at: string | null }>)
      .map((r) => r.expires_at)
      .filter((d): d is string => typeof d === 'string' && new Date(d).getTime() > now)
      .sort()

    return {
      purchased,
      used,
      balance: purchased - used,
      earliestExpiry: futureExpiries[0] ?? null,
    }
  } catch (err) {
    logger.warn('api-cost-overview: credits read failed', { err: String(err) })
    return { purchased: 0, used: 0, balance: 0, earliestExpiry: null }
  }
}

/**
 * One-shot overview of every paid API surface for the operator dashboard.
 * Runs the 3 source queries (SERP, AI, credits) in parallel.
 *
 * `userId` is required because AI cost logs and credit ledger are
 * user-scoped. SERP quotas are global (no user dimension) — they're the
 * same for everybody on the workspace.
 */
export async function getApiCostOverview(userId: string): Promise<ApiCostOverview> {
  const [serp, ai, credits] = await Promise.all([
    loadSerpSnapshot(),
    loadAiSnapshot(userId),
    loadCreditsSnapshot(userId),
  ])

  return {
    month: currentMonth(),
    totalSpendCents: serp.totalCostCents + ai.totalCostCents,
    totalSpendUsd: serp.totalCostUsd + ai.totalCostUsd,
    serp,
    ai,
    credits,
  }
}

// ─── Time-series breakdown (for weekly/monthly views + export) ──────────────

export type CostGranularity = 'day' | 'week' | 'month'

/** One bucket × provider row of AI spend, full float precision. */
export interface CostBreakdownRow {
  /** Bucket key: YYYY-MM-DD (day), YYYY-Www (ISO week), or YYYY-MM (month). */
  bucket: string
  /** Canonical provider key (openai, gemini, …). */
  provider: string
  calls: number
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface CostBreakdown {
  granularity: CostGranularity
  from: string
  to: string
  rows: CostBreakdownRow[]
  totalCostUsd: number
  totalCalls: number
}

/** ISO-8601 week key (YYYY-Www) for a date, using Thursday-of-week rule. */
function isoWeekKey(d: Date): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = dt.getUTCDay() || 7 // Sun=0 → 7
  dt.setUTCDate(dt.getUTCDate() + 4 - day) // shift to Thursday
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function bucketKey(iso: string, granularity: CostGranularity): string {
  const d = new Date(iso)
  if (granularity === 'month')
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  if (granularity === 'week') return isoWeekKey(d)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

/**
 * Per-bucket × per-provider AI spend over a date range, summed in full float
 * precision. Powers the weekly/monthly toggle and the CSV/Excel/PDF export.
 *
 * Defaults to the trailing 30 days, daily granularity. SERP costs are monthly
 * aggregates (no per-call timestamps) so they are intentionally excluded here
 * — this breakdown is the per-call AI ledger, which is where sub-cent costs
 * accumulate and where date/type granularity is meaningful.
 */
export async function getCostBreakdown(
  userId: string,
  opts: { granularity?: CostGranularity; from?: Date; to?: Date } = {},
): Promise<CostBreakdown> {
  const granularity = opts.granularity ?? 'day'
  const to = opts.to ?? new Date()
  const from = opts.from ?? new Date(to.getTime() - 30 * 86400000)

  const map = new Map<string, CostBreakdownRow>()
  const db = createServerClient() as any

  if (db) {
    try {
      const { data: rows } = await db
        .from('ai_cost_logs')
        .select('provider, input_tokens, output_tokens, cost_usd, created_at')
        .eq('user_id', userId)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .limit(100000)

      for (const r of (rows ?? []) as Array<{
        provider: string | null
        input_tokens: number | null
        output_tokens: number | null
        cost_usd: number | null
        created_at: string
      }>) {
        const provider = canonicalProvider(r.provider || 'unknown')
        const bucket = bucketKey(r.created_at, granularity)
        const k = `${bucket}|${provider}`
        const acc = map.get(k) ?? {
          bucket,
          provider,
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
        }
        acc.calls += 1
        acc.inputTokens += r.input_tokens ?? 0
        acc.outputTokens += r.output_tokens ?? 0
        acc.costUsd += r.cost_usd ?? 0
        map.set(k, acc)
      }
    } catch (err) {
      logger.warn('api-cost-overview: breakdown read failed', { err: String(err) })
    }
  }

  // Sort by bucket then provider for stable, readable export output.
  const rows = [...map.values()].sort(
    (a, b) => a.bucket.localeCompare(b.bucket) || a.provider.localeCompare(b.provider),
  )
  return {
    granularity,
    from: from.toISOString(),
    to: to.toISOString(),
    rows,
    totalCostUsd: rows.reduce((s, r) => s + r.costUsd, 0),
    totalCalls: rows.reduce((s, r) => s + r.calls, 0),
  }
}
