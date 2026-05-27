// PATH: src/lib/services/exec-summary.ts
//
// Builds a single 1-page executive summary for a brand structured around
// the 4 questions from the industry research "AI search visibility reporting" piece:
//
//   Q1. Where do we appear?            (citation frequency + prompt coverage)
//   Q2. How accurately are we described? (sentiment + driver narrative)
//   Q3. Are we winning or losing vs competitors? (share of voice + drivers)
//   Q4. Are business objectives improving?       (branded search + AI assist)
//
// Composes existing utilities: computeShareOfVoiceByEngine,
// extractBusinessDrivers, classifyBrandedQueries + aiAssistScore. Returns
// a structured payload the route can serve as JSON or render to markdown
// for export.

import { createServerClient } from '@/lib/supabase'
import { computeShareOfVoiceByEngine, type SovInputRow } from '@/lib/services/share-of-voice'
import {
  extractBusinessDrivers,
  findNarrativeGaps,
  type MonitoringRowForDrivers,
} from '@/lib/utils/business-drivers'
import {
  brandAnchors,
  classifyBrandedQueries,
  aiAssistScore,
  type QueryRow,
} from '@/lib/utils/branded-search'
import { logger } from '@/lib/logger'
import type { Brand } from '@/types'

export interface ExecSummaryPeriod {
  startDate: string
  endDate: string
  days: number
}

export interface ExecSummaryQ1 {
  totalResponses: number
  brandMentions: number
  mentionRate: number // %
  uniquePromptsCovered: number
}

export interface ExecSummaryQ2 {
  avgSentiment: number | null // -1..1
  sentimentLabel: 'positive' | 'neutral' | 'negative' | 'unknown'
  topPositiveDriver: string | null
  topNegativeDriver: string | null
}

export interface ExecSummaryQ3 {
  brandShare: number // %
  brandRank: number | null
  totalCompetitors: number
  narrativeGaps: Array<{ driver: string; leader: string; gap: number }>
  perEngine: Array<{ engine: string; share: number; rank: number | null }>
}

export interface ExecSummaryQ4 {
  brandedClicks: number
  brandedClicksDeltaPct: number | null
  brandedImpressions: number
  brandedImpressionsDeltaPct: number | null
  aiAssistScore: number | null
  aiAssistVerdict: 'assisted' | 'neutral' | 'cannibalised' | 'unknown'
}

export interface ExecSummary {
  brandName: string
  period: ExecSummaryPeriod
  q1: ExecSummaryQ1
  q2: ExecSummaryQ2
  q3: ExecSummaryQ3
  q4: ExecSummaryQ4
  /** Operator-facing one-line summary derived from the 4 sections. */
  headline: string
}

interface MonitoringRow {
  brand_mentioned: boolean | null
  mention_count: number | null
  mention_position: number | null
  competitor_mentions: Array<{ name?: string | null; position?: number; count?: number }> | null
  sentiment_score: number | null
  response_text: string | null
  created_at: string | null
  engine: string | null
  prompt_id: string | null
}

interface GscQueryRow {
  date: string
  dimension_value: string | null
  clicks: number | null
  impressions: number | null
  position: number | null
}

function sentimentLabel(score: number | null): ExecSummaryQ2['sentimentLabel'] {
  if (score == null) return 'unknown'
  if (score >= 0.2) return 'positive'
  if (score <= -0.2) return 'negative'
  return 'neutral'
}

function headlineFor(s: Omit<ExecSummary, 'headline'>): string {
  const parts: string[] = []
  parts.push(
    `${s.q1.mentionRate.toFixed(0)}% mention rate across ${s.q1.totalResponses} AI responses`,
  )
  if (s.q3.brandRank != null) {
    parts.push(`rank #${s.q3.brandRank} of ${s.q3.totalCompetitors + 1} brands`)
  }
  if (s.q4.aiAssistVerdict !== 'unknown') {
    parts.push(`AI ${s.q4.aiAssistVerdict}`)
  }
  if (s.q4.brandedClicksDeltaPct != null) {
    const sign = s.q4.brandedClicksDeltaPct >= 0 ? '+' : ''
    parts.push(`branded clicks ${sign}${s.q4.brandedClicksDeltaPct.toFixed(1)}%`)
  }
  return parts.join(' · ')
}

/**
 * Build the exec summary for a brand. Throws when the DB is unavailable
 * or the brand row can't be loaded.
 */
export async function buildExecSummary(brand: Brand, days: number): Promise<ExecSummary> {
  const db = createServerClient()
  if (!db) throw new Error('Database not configured')

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - days)
  const sinceISO = startDate.toISOString()
  const period: ExecSummaryPeriod = {
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    days,
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [monitoringRes, gscRes] = await Promise.all([
    (db as any)
      .from('monitoring_results')
      .select(
        'brand_mentioned, mention_count, mention_position, competitor_mentions, sentiment_score, response_text, created_at, engine, prompt_id',
      )
      .eq('brand_id', brand.id)
      .gte('created_at', sinceISO)
      .order('created_at', { ascending: true })
      .limit(5000),
    (db as any)
      .from('gsc_performance')
      .select('date, dimension_value, clicks, impressions, position')
      .eq('brand_id', brand.id)
      .eq('dimension_type', 'query')
      .gte('date', period.startDate)
      .order('date', { ascending: true })
      .limit(10_000),
  ])
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (monitoringRes.error) {
    logger.error('exec-summary: monitoring query failed', { err: monitoringRes.error })
  }
  if (gscRes.error) {
    logger.warn('exec-summary: gsc query failed (non-fatal)', { err: gscRes.error })
  }

  const monitoring: MonitoringRow[] = (monitoringRes.data ?? []) as MonitoringRow[]
  const gscRows: GscQueryRow[] = (gscRes.data ?? []) as GscQueryRow[]

  // ── Q1: Where do we appear?
  const totalResponses = monitoring.length
  const brandMentions = monitoring.filter((m) => m.brand_mentioned === true).length
  const uniquePrompts = new Set(monitoring.map((m) => m.prompt_id).filter(Boolean)).size
  const q1: ExecSummaryQ1 = {
    totalResponses,
    brandMentions,
    mentionRate: totalResponses > 0 ? Math.round((brandMentions / totalResponses) * 1000) / 10 : 0,
    uniquePromptsCovered: uniquePrompts,
  }

  // ── Q2: How accurately are we described?
  const sentimentScores = monitoring
    .filter((m) => m.brand_mentioned === true && typeof m.sentiment_score === 'number')
    .map((m) => m.sentiment_score as number)
  const avgSentiment =
    sentimentScores.length > 0
      ? Math.round((sentimentScores.reduce((s, v) => s + v, 0) / sentimentScores.length) * 100) /
        100
      : null

  const driversReport = extractBusinessDrivers(
    monitoring.map<MonitoringRowForDrivers>((m) => ({
      brand_mentioned: m.brand_mentioned,
      response_text: m.response_text,
      competitor_mentions: m.competitor_mentions,
    })),
    brand.name,
    brand.competitors ?? [],
  )
  // Top driver where the brand leads → positive driver. Top driver where
  // it falls behind → negative driver.
  const brandDriverWins = driversReport.drivers.filter((d) => d.leader && d.leader.isBrand)
  const brandDriverLosses = findNarrativeGaps(driversReport)
  const q2: ExecSummaryQ2 = {
    avgSentiment,
    sentimentLabel: sentimentLabel(avgSentiment),
    topPositiveDriver: brandDriverWins[0] ? brandDriverWins[0].driver.label : null,
    topNegativeDriver: brandDriverLosses[0] ? brandDriverLosses[0].driver.label : null,
  }

  // ── Q3: Are we winning or losing vs competitors?
  const sovByEngine = computeShareOfVoiceByEngine(
    monitoring.map<SovInputRow>((m) => ({
      brand_mentioned: m.brand_mentioned,
      mention_count: m.mention_count,
      mention_position: m.mention_position,
      competitor_mentions: (m.competitor_mentions ?? []) as SovInputRow['competitor_mentions'],
      created_at: m.created_at,
      engine: m.engine,
    })),
    brand.name,
  )
  const overall = sovByEngine.overall
  const brandEntity = overall.entities.find((e) => e.isBrand)
  const brandShare = brandEntity?.share ?? 0
  const rank = brandEntity ? 1 + overall.entities.filter((e) => e.share > brandShare).length : null
  const q3: ExecSummaryQ3 = {
    brandShare,
    brandRank: rank,
    totalCompetitors: Math.max(0, overall.entities.length - 1),
    narrativeGaps: brandDriverLosses.slice(0, 3).map((g) => ({
      driver: g.driver.label,
      leader: g.leader.brand,
      gap: g.gap,
    })),
    perEngine: sovByEngine.byEngine.map((e) => {
      const eb = e.entities.find((x) => x.isBrand)
      const sh = eb?.share ?? 0
      return {
        engine: e.engine,
        share: sh,
        rank: eb ? 1 + e.entities.filter((x) => x.share > sh).length : null,
      }
    }),
  }

  // ── Q4: Are business objectives improving?
  const ownedDomain = (brand.domain ?? brand.domains?.[0] ?? '').trim()
  const anchors = brandAnchors({
    name: brand.name,
    aliases: brand.aliases ?? [],
    domain: ownedDomain || null,
  })
  const gscInputs: QueryRow[] = gscRows
    .filter((r) => typeof r.dimension_value === 'string' && r.dimension_value.length > 0)
    .map((r) => ({
      query: r.dimension_value as string,
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      position: r.position ?? undefined,
      date: r.date,
    }))
  const { summary: brandedSummary, timeline: brandedTimeline } = classifyBrandedQueries(
    gscInputs,
    anchors,
  )
  const growth = (() => {
    if (brandedTimeline.length < 4) return { clicksDelta: null, impressionsDelta: null }
    const mid = Math.floor(brandedTimeline.length / 2)
    const a = brandedTimeline.slice(0, mid)
    const b = brandedTimeline.slice(mid)
    const sum = (arr: typeof brandedTimeline, key: 'brandedClicks' | 'brandedImpressions') =>
      arr.reduce((s, p) => s + p[key], 0)
    const cA = sum(a, 'brandedClicks')
    const cB = sum(b, 'brandedClicks')
    const iA = sum(a, 'brandedImpressions')
    const iB = sum(b, 'brandedImpressions')
    const delta = (x: number, y: number) => (x > 0 ? Math.round(((y - x) / x) * 1000) / 10 : null)
    return { clicksDelta: delta(cA, cB), impressionsDelta: delta(iA, iB) }
  })()
  const assist = aiAssistScore(brandedTimeline)
  const q4: ExecSummaryQ4 = {
    brandedClicks: brandedSummary.branded.clicks,
    brandedClicksDeltaPct: growth.clicksDelta,
    brandedImpressions: brandedSummary.branded.impressions,
    brandedImpressionsDeltaPct: growth.impressionsDelta,
    aiAssistScore: assist.score,
    aiAssistVerdict: assist.verdict,
  }

  const partial: Omit<ExecSummary, 'headline'> = {
    brandName: brand.name,
    period,
    q1,
    q2,
    q3,
    q4,
  }
  return { ...partial, headline: headlineFor(partial) }
}

// ────────────────────────────────────────────────────────────────────────
// Monthly trend (II) — N-month rollup so the deck can show direction
// instead of a single snapshot. Reads monitoring_results + gsc_performance
// over the full window in ONE query each, then buckets in memory so we
// don't trigger N round-trips.

export interface ExecSummaryMonthlyPoint {
  month: string // YYYY-MM
  totalResponses: number
  brandMentions: number
  mentionRate: number // %
  avgSentiment: number | null
  brandedClicks: number
  brandedImpressions: number
}

export interface ExecSummaryTrend {
  brandName: string
  months: ExecSummaryMonthlyPoint[]
  // Direction across the available window: "up" if last month > first
  // month by > 10%, "down" if < −10%, "flat" otherwise.
  mentionRateDirection: 'up' | 'down' | 'flat'
  brandedClicksDirection: 'up' | 'down' | 'flat'
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function directionOf(first: number, last: number): 'up' | 'down' | 'flat' {
  if (first === 0 && last === 0) return 'flat'
  if (first === 0) return last > 0 ? 'up' : 'flat'
  const delta = (last - first) / first
  if (delta > 0.1) return 'up'
  if (delta < -0.1) return 'down'
  return 'flat'
}

export async function buildExecSummaryTrend(
  brand: Brand,
  months: number,
): Promise<ExecSummaryTrend> {
  const db = createServerClient()
  if (!db) throw new Error('Database not configured')

  const clampedMonths = Math.max(2, Math.min(12, Math.floor(months) || 6))
  const endDate = new Date()
  const startDate = new Date(endDate)
  startDate.setUTCMonth(startDate.getUTCMonth() - clampedMonths)
  const sinceIso = startDate.toISOString()

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [monitoringRes, gscRes] = await Promise.all([
    (db as any)
      .from('monitoring_results')
      .select('brand_mentioned, sentiment_score, created_at')
      .eq('brand_id', brand.id)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .limit(50_000),
    (db as any)
      .from('gsc_performance')
      .select('date, dimension_value, clicks, impressions')
      .eq('brand_id', brand.id)
      .eq('dimension_type', 'query')
      .gte('date', startDate.toISOString().slice(0, 10))
      .order('date', { ascending: true })
      .limit(50_000),
  ])
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (monitoringRes.error) {
    logger.warn('exec-summary trend: monitoring query failed', { err: monitoringRes.error })
  }
  if (gscRes.error) {
    logger.warn('exec-summary trend: gsc query failed (non-fatal)', { err: gscRes.error })
  }

  type MonthBucket = {
    totalResponses: number
    brandMentions: number
    sentimentSum: number
    sentimentCount: number
    brandedClicks: number
    brandedImpressions: number
  }
  const bucketByMonth = new Map<string, MonthBucket>()
  const ensure = (key: string): MonthBucket => {
    let b = bucketByMonth.get(key)
    if (!b) {
      b = {
        totalResponses: 0,
        brandMentions: 0,
        sentimentSum: 0,
        sentimentCount: 0,
        brandedClicks: 0,
        brandedImpressions: 0,
      }
      bucketByMonth.set(key, b)
    }
    return b
  }

  for (const row of (monitoringRes.data ?? []) as Array<{
    brand_mentioned: boolean | null
    sentiment_score: number | null
    created_at: string | null
  }>) {
    if (!row.created_at) continue
    const key = monthKey(new Date(row.created_at))
    const b = ensure(key)
    b.totalResponses++
    if (row.brand_mentioned) b.brandMentions++
    if (row.brand_mentioned && typeof row.sentiment_score === 'number') {
      b.sentimentSum += row.sentiment_score
      b.sentimentCount++
    }
  }

  const anchors = brandAnchors({ name: brand.name, aliases: brand.aliases ?? [] })
  for (const row of (gscRes.data ?? []) as GscQueryRow[]) {
    if (!row.date) continue
    const text = (row.dimension_value ?? '').toLowerCase()
    if (anchors.length > 0 && !anchors.some((a) => text.includes(a))) continue
    const key = monthKey(new Date(row.date))
    const b = ensure(key)
    b.brandedClicks += row.clicks ?? 0
    b.brandedImpressions += row.impressions ?? 0
  }

  // Render every month in the window even if empty so the table doesn't
  // collapse on quiet months.
  const monthList: string[] = []
  for (let i = 0; i <= clampedMonths; i++) {
    const d = new Date(startDate)
    d.setUTCMonth(d.getUTCMonth() + i)
    monthList.push(monthKey(d))
  }
  const seen = new Set<string>()
  const unique = monthList.filter((m) => {
    if (seen.has(m)) return false
    seen.add(m)
    return true
  })

  const points: ExecSummaryMonthlyPoint[] = unique.map((month) => {
    const b = bucketByMonth.get(month)
    return {
      month,
      totalResponses: b?.totalResponses ?? 0,
      brandMentions: b?.brandMentions ?? 0,
      mentionRate:
        b && b.totalResponses > 0
          ? Math.round((b.brandMentions / b.totalResponses) * 1000) / 10
          : 0,
      avgSentiment:
        b && b.sentimentCount > 0
          ? Math.round((b.sentimentSum / b.sentimentCount) * 100) / 100
          : null,
      brandedClicks: b?.brandedClicks ?? 0,
      brandedImpressions: b?.brandedImpressions ?? 0,
    }
  })

  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]
  return {
    brandName: brand.name,
    months: points,
    mentionRateDirection: directionOf(firstPoint?.mentionRate ?? 0, lastPoint?.mentionRate ?? 0),
    brandedClicksDirection: directionOf(
      firstPoint?.brandedClicks ?? 0,
      lastPoint?.brandedClicks ?? 0,
    ),
  }
}

export function execSummaryTrendToMarkdown(trend: ExecSummaryTrend): string {
  const lines: string[] = []
  lines.push(`# AI Visibility — Monthly Trend`)
  lines.push('')
  lines.push(`**Brand:** ${trend.brandName}`)
  lines.push(
    `**Window:** ${trend.months[0]?.month ?? '—'} → ${trend.months[trend.months.length - 1]?.month ?? '—'}`,
  )
  lines.push('')
  lines.push(
    `**Mention rate trend:** ${trend.mentionRateDirection.toUpperCase()} · **Branded clicks trend:** ${trend.brandedClicksDirection.toUpperCase()}`,
  )
  lines.push('')
  lines.push(
    '| Month | Responses | Brand mentions | Mention % | Sentiment | Branded clicks | Branded impressions |',
  )
  lines.push(
    '|-------|-----------|----------------|-----------|-----------|----------------|---------------------|',
  )
  for (const p of trend.months) {
    lines.push(
      `| ${p.month} | ${p.totalResponses} | ${p.brandMentions} | ${p.mentionRate.toFixed(1)}% | ${p.avgSentiment != null ? p.avgSentiment.toFixed(2) : '—'} | ${p.brandedClicks} | ${p.brandedImpressions} |`,
    )
  }
  return lines.join('\n')
}

// ────────────────────────────────────────────────────────────────────────
// Tiered KPI deck (JJ) — Tier 1 / Tier 2 / Tier 3 framing from the industry research
// "Create an SEO + AI Search Marketing Report" piece. Wraps the existing
// ExecSummary so the same data renders three ways: 4-question JSON, plain
// MD, and now a client-deck-ready tiered MD.

export interface TieredKpiDeck {
  brandName: string
  period: ExecSummaryPeriod
  tier1: Array<{ label: string; value: string; trend?: string }>
  tier2: Array<{ label: string; value: string; trend?: string }>
  tier3: Array<{ label: string; value: string; trend?: string }>
}

export function buildTieredKpiDeck(summary: ExecSummary): TieredKpiDeck {
  const tier1: TieredKpiDeck['tier1'] = [
    {
      label: 'AI mention rate',
      value: `${summary.q1.mentionRate.toFixed(1)}%`,
    },
    {
      label: 'Brand mentions',
      value: `${summary.q1.brandMentions} / ${summary.q1.totalResponses}`,
    },
    {
      label: 'Branded clicks (GSC proxy for AI uplift)',
      value: String(summary.q4.brandedClicks),
      trend:
        summary.q4.brandedClicksDeltaPct != null
          ? `${summary.q4.brandedClicksDeltaPct >= 0 ? '+' : ''}${summary.q4.brandedClicksDeltaPct.toFixed(1)}% vs first half`
          : undefined,
    },
    {
      label: 'AI assist verdict',
      value: summary.q4.aiAssistVerdict,
      trend:
        summary.q4.aiAssistScore != null
          ? `score ${summary.q4.aiAssistScore.toFixed(1)}`
          : undefined,
    },
  ]
  const tier2: TieredKpiDeck['tier2'] = [
    {
      label: 'Share of voice (all engines)',
      value: `${summary.q3.brandShare.toFixed(1)}%`,
      trend: `rank ${summary.q3.brandRank ?? '—'} of ${summary.q3.totalCompetitors + 1}`,
    },
    {
      label: 'Unique prompts covered',
      value: String(summary.q1.uniquePromptsCovered),
    },
    ...summary.q3.perEngine.map((e) => ({
      label: `SOV — ${e.engine}`,
      value: `${e.share.toFixed(1)}%`,
      trend: e.rank != null ? `rank ${e.rank}` : undefined,
    })),
  ]
  const tier3: TieredKpiDeck['tier3'] = [
    {
      label: 'Avg sentiment',
      value: summary.q2.avgSentiment != null ? summary.q2.avgSentiment.toFixed(2) : 'no data',
      trend: summary.q2.sentimentLabel,
    },
    ...(summary.q2.topPositiveDriver
      ? [{ label: 'Owning narrative', value: summary.q2.topPositiveDriver }]
      : []),
    ...(summary.q2.topNegativeDriver
      ? [{ label: 'Losing narrative', value: summary.q2.topNegativeDriver }]
      : []),
    ...summary.q3.narrativeGaps.slice(0, 3).map((g) => ({
      label: `Gap on "${g.driver}"`,
      value: `${g.leader} leads (−${g.gap})`,
    })),
    {
      label: 'Branded impressions',
      value: String(summary.q4.brandedImpressions),
      trend:
        summary.q4.brandedImpressionsDeltaPct != null
          ? `${summary.q4.brandedImpressionsDeltaPct >= 0 ? '+' : ''}${summary.q4.brandedImpressionsDeltaPct.toFixed(1)}%`
          : undefined,
    },
  ]
  return {
    brandName: summary.brandName,
    period: summary.period,
    tier1,
    tier2,
    tier3,
  }
}

function tierBlock(title: string, items: TieredKpiDeck['tier1']): string[] {
  const out: string[] = [`## ${title}`, '']
  for (const it of items) {
    const trend = it.trend ? ` _(${it.trend})_` : ''
    out.push(`- **${it.label}:** ${it.value}${trend}`)
  }
  out.push('')
  return out
}

export function tieredKpiDeckToMarkdown(deck: TieredKpiDeck): string {
  const out: string[] = []
  out.push(`# AI Visibility — Tiered KPI Deck`)
  out.push('')
  out.push(`**Brand:** ${deck.brandName}`)
  out.push(
    `**Period:** ${deck.period.startDate} → ${deck.period.endDate} (${deck.period.days} days)`,
  )
  out.push('')
  out.push(
    `_Tier framing from the industry research "Create an SEO + AI Search Marketing Report" template. Tier 1 = business impact, Tier 2 = visibility context, Tier 3 = supporting signal._`,
  )
  out.push('')
  out.push(...tierBlock('Tier 1 — Primary KPIs', deck.tier1))
  out.push(...tierBlock('Tier 2 — Secondary metrics', deck.tier2))
  out.push(...tierBlock('Tier 3 — Supporting signals', deck.tier3))
  return out.join('\n')
}

/**
 * Render the exec summary as a Markdown document suitable for paste-into-
 * Notion / Slack / PR review. Stable formatting — works for diffs.
 */
export function execSummaryToMarkdown(summary: ExecSummary): string {
  const lines: string[] = []
  const sentimentEmoji =
    summary.q2.sentimentLabel === 'positive'
      ? '✅'
      : summary.q2.sentimentLabel === 'negative'
        ? '⚠️'
        : '·'
  const assistEmoji =
    summary.q4.aiAssistVerdict === 'assisted'
      ? '↑'
      : summary.q4.aiAssistVerdict === 'cannibalised'
        ? '↓'
        : '→'

  lines.push(`# AI Visibility — Executive Summary`)
  lines.push('')
  lines.push(`**Brand:** ${summary.brandName}`)
  lines.push(
    `**Period:** ${summary.period.startDate} → ${summary.period.endDate} (${summary.period.days} days)`,
  )
  lines.push('')
  lines.push(`**TL;DR:** ${summary.headline}`)
  lines.push('')

  lines.push(`## Q1 — Where do we appear?`)
  lines.push(`- Mention rate: **${summary.q1.mentionRate.toFixed(1)}%**`)
  lines.push(
    `- ${summary.q1.brandMentions} brand mentions across ${summary.q1.totalResponses} AI responses`,
  )
  lines.push(`- Covered ${summary.q1.uniquePromptsCovered} unique prompts`)
  lines.push('')

  lines.push(`## Q2 — How accurately are we described?`)
  lines.push(
    `- Avg. sentiment: **${summary.q2.avgSentiment != null ? summary.q2.avgSentiment.toFixed(2) : 'n/a'}** (${summary.q2.sentimentLabel}) ${sentimentEmoji}`,
  )
  if (summary.q2.topPositiveDriver)
    lines.push(`- Owning narrative: **${summary.q2.topPositiveDriver}**`)
  if (summary.q2.topNegativeDriver)
    lines.push(`- Losing narrative: **${summary.q2.topNegativeDriver}**`)
  lines.push('')

  lines.push(`## Q3 — Are we winning or losing vs competitors?`)
  lines.push(
    `- Brand share of voice: **${summary.q3.brandShare.toFixed(1)}%** (rank ${
      summary.q3.brandRank ?? 'n/a'
    } of ${summary.q3.totalCompetitors + 1})`,
  )
  if (summary.q3.perEngine.length > 0) {
    lines.push(`- By engine:`)
    for (const e of summary.q3.perEngine) {
      lines.push(`  - ${e.engine}: ${e.share.toFixed(1)}% (rank ${e.rank ?? 'n/a'})`)
    }
  }
  if (summary.q3.narrativeGaps.length > 0) {
    lines.push(`- Narrative gaps:`)
    for (const g of summary.q3.narrativeGaps) {
      lines.push(`  - ${g.driver}: ${g.leader} leads (gap −${g.gap})`)
    }
  }
  lines.push('')

  lines.push(`## Q4 — Are business objectives improving?`)
  lines.push(
    `- Branded clicks: **${summary.q4.brandedClicks}** (${
      summary.q4.brandedClicksDeltaPct != null
        ? `${summary.q4.brandedClicksDeltaPct >= 0 ? '+' : ''}${summary.q4.brandedClicksDeltaPct.toFixed(1)}% vs first half`
        : 'no trend data'
    })`,
  )
  lines.push(
    `- Branded impressions: **${summary.q4.brandedImpressions}** (${
      summary.q4.brandedImpressionsDeltaPct != null
        ? `${summary.q4.brandedImpressionsDeltaPct >= 0 ? '+' : ''}${summary.q4.brandedImpressionsDeltaPct.toFixed(1)}%`
        : 'no trend data'
    })`,
  )
  lines.push(
    `- AI assist verdict: **${summary.q4.aiAssistVerdict}** ${assistEmoji} (score ${
      summary.q4.aiAssistScore != null ? summary.q4.aiAssistScore.toFixed(1) : 'n/a'
    })`,
  )
  lines.push('')

  return lines.join('\n')
}
