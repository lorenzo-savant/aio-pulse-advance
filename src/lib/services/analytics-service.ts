// PATH: src/lib/services/analytics-service.ts
// Comprehensive Analytics Service - Historical data tracking and comparison

import { createServerClient } from '@/lib/supabase'

interface TimeSeriesPoint {
  date: string
  value: number
  change?: number
  changePercent?: number
}

interface ComparisonResult {
  current: number
  previous: number
  change: number
  changePercent: number
  trend: 'up' | 'down' | 'stable'
}

interface HistoricalStats {
  brandId: string
  period: string
  snapshots: TimeSeriesPoint[]
  comparison: ComparisonResult
  summary: {
    totalSnapshots: number
    avgValue: number
    minValue: number
    maxValue: number
    trend: 'up' | 'down' | 'stable'
  }
}

/**
 * Get historical data for a brand with time series
 */
export async function getHistoricalAnalytics(
  brandId: string,
  options: {
    metric: 'citations' | 'visibility' | 'sentiment' | 'health'
    period: '7d' | '30d' | '90d' | '1y'
    engine?: string
  },
): Promise<HistoricalStats> {
  const db = createServerClient()
  if (!db) throw new Error('Database not configured')

  const days =
    {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
    }[options.period] || 30

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  const previousStartDate = new Date()
  previousStartDate.setDate(previousStartDate.getDate() - days * 2)

  // Helper to query snapshots for this brand within a date range
  const querySnapshots = async (from: string, to: string) =>
    db
      .from('citation_snapshots')
      .select('*')
      .eq('brand_id', brandId)
      .eq('engine', 'all')
      .eq('category', 'all')
      .eq('language', 'all')
      .gte('scan_date', from)
      .lte('scan_date', to)
      .order('scan_date', { ascending: true })

  const todayStr = new Date().toISOString().split('T')[0]!
  const startStr = startDate.toISOString().split('T')[0]!

  // Get current period data.
  //
  // This read used to lazily rebuild snapshots when it found none. That is
  // gone: reads return what exists. Rebuilding runs where it belongs — in the
  // monitoring cron after each scan, and behind the explicit POST
  // /api/snapshots action — for two reasons.
  //
  // First, the correct writer produces engine × category × language rows,
  // roughly 120 per date for a brand with a handful of categories and
  // languages. Doing that for every date in a period, inside a page load,
  // is minutes of work behind an HTTP handler that can time out mid-write.
  //
  // Second, two concurrent page loads both saw an empty window and both
  // started the same rebuild.
  const { data: currentData, error: currentError } = await querySnapshots(startStr, todayStr)

  // Get previous period for comparison (same filters)
  const { data: previousData } = await querySnapshots(
    previousStartDate.toISOString().split('T')[0]!,
    startStr,
  )

  if (currentError) throw currentError

  // Aggregate by date
  const currentByDate = aggregateByDate(currentData || [], options.metric)
  const previousByDate = aggregateByDate(previousData || [], options.metric)

  // Calculate comparison
  const currentAvg = calculateAverage(currentByDate)
  const previousAvg = calculateAverage(previousByDate)
  const comparison = calculateComparison(currentAvg, previousAvg)

  // Build time series
  const snapshots = buildTimeSeries(currentByDate, previousByDate)

  return {
    brandId,
    period: options.period,
    snapshots,
    comparison,
    summary: {
      totalSnapshots: currentByDate.length,
      avgValue: currentAvg,
      minValue: Math.min(...currentByDate.map((d) => d.value)),
      maxValue: Math.max(...currentByDate.map((d) => d.value)),
      trend: comparison.trend,
    },
  }
}

/**
 * Aggregate data by date for a specific metric
 */
function aggregateByDate(
  data: Array<{ scan_date: string; [key: string]: unknown }>,
  metric: string,
): TimeSeriesPoint[] {
  const byDate = new Map<string, number[]>()

  for (const row of data) {
    const date = row.scan_date
    if (!byDate.has(date)) {
      byDate.set(date, [])
    }

    let value = 0
    switch (metric) {
      case 'citations':
        value = Number(row.citation_rate) || 0
        break
      case 'visibility':
        value = Number(row.avg_visibility) || 0
        break
      case 'sentiment':
        value = Number(row.avg_sentiment) || 0
        break
      case 'health':
        value =
          Number(row.citation_rate) * 0.4 +
          Number(row.avg_visibility) * 0.4 +
          Number(row.avg_sentiment) * 0.2
        break
      default:
        value = Number(row.citation_rate) || 0
    }

    byDate.get(date)!.push(value)
  }

  return Array.from(byDate.entries()).map(([date, values]) => ({
    date,
    value: values.reduce((a, b) => a + b, 0) / values.length,
  }))
}

/**
 * Calculate average from time series
 */
function calculateAverage(points: TimeSeriesPoint[]): number {
  if (points.length === 0) return 0
  const sum = points.reduce((acc, p) => acc + p.value, 0)
  return Math.round((sum / points.length) * 100) / 100
}

/**
 * Calculate comparison between two periods
 */
function calculateComparison(current: number, previous: number): ComparisonResult {
  const change = current - previous
  const changePercent =
    previous === 0 ? (current > 0 ? 100 : 0) : Math.round((change / previous) * 100 * 100) / 100

  let trend: 'up' | 'down' | 'stable' = 'stable'
  if (changePercent > 5) trend = 'up'
  else if (changePercent < -5) trend = 'down'

  return {
    current,
    previous,
    change: Math.round(change * 100) / 100,
    changePercent,
    trend,
  }
}

/**
 * Build complete time series with change data
 */
function buildTimeSeries(
  current: TimeSeriesPoint[],
  previous: TimeSeriesPoint[],
): TimeSeriesPoint[] {
  const allDates = new Set([...current.map((d) => d.date), ...previous.map((d) => d.date)])
  const previousMap = new Map(previous.map((d) => [d.date, d.value]))

  return Array.from(allDates)
    .sort()
    .map((date) => {
      const value = current.find((d) => d.date === date)?.value || 0
      const prevValue = previousMap.get(date) || 0
      const change = value - prevValue
      const changePercent = prevValue === 0 ? 0 : Math.round((change / prevValue) * 100 * 100) / 100

      return {
        date,
        value: Math.round(value * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent,
      }
    })
}

/**
 * Get competitor comparison data
 */
export async function getCompetitorComparison(
  brandId: string,
  options: { period: '7d' | '30d' | '90d' },
) {
  const db = createServerClient()
  if (!db) throw new Error('Database not configured')

  const days = { '7d': 7, '30d': 30, '90d': 90 }[options.period] || 30
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Get brand data
  const { data: brand } = await db
    .from('brands')
    .select('name, competitors')
    .eq('id', brandId)
    .single()

  const competitors = brand?.competitors || []

  const queryBrandSnaps = () =>
    db
      .from('citation_snapshots')
      .select('scan_date, citation_rate, avg_visibility, competitor_rates')
      .eq('brand_id', brandId)
      .eq('engine', 'all')
      .eq('category', 'all')
      .eq('language', 'all')
      .gte('scan_date', startDate.toISOString().split('T')[0])
      .order('scan_date', { ascending: false })

  // Get brand snapshots (aggregate engine='all', category='all').
  // No lazy rebuild here either — see the note in getHistoricalAnalytics.
  const { data: brandSnapshots } = await queryBrandSnaps()

  // Calculate brand averages
  const brandAvgCitation = calculateAverage(
    (brandSnapshots || []).map((s) => ({ date: '', value: Number(s.citation_rate) || 0 })),
  )
  const brandAvgVisibility = calculateAverage(
    (brandSnapshots || []).map((s) => ({ date: '', value: Number(s.avg_visibility) || 0 })),
  )

  // Aggregate real competitor rates from snapshots (no fake data)
  const competitorAgg = new Map<string, { citationSum: number; count: number }>()
  for (const snap of brandSnapshots || []) {
    const rates = (snap.competitor_rates || {}) as Record<string, number>
    for (const [name, rate] of Object.entries(rates)) {
      const entry = competitorAgg.get(name) || { citationSum: 0, count: 0 }
      entry.citationSum += Number(rate) || 0
      entry.count += 1
      competitorAgg.set(name, entry)
    }
  }

  const competitorsData = (competitors as string[]).map((comp) => {
    const agg = competitorAgg.get(comp)
    const avgCitation = agg && agg.count > 0 ? agg.citationSum / agg.count : 0
    return {
      name: comp,
      avgCitation: Math.round(avgCitation * 100) / 100,
      avgVisibility: 0, // visibility is brand-specific; not tracked per competitor yet
    }
  })

  return {
    brand: {
      name: brand?.name || 'Your Brand',
      avgCitation: brandAvgCitation,
      avgVisibility: brandAvgVisibility,
    },
    competitors: competitorsData,
    period: options.period,
    snapshotCount: brandSnapshots?.length || 0,
  }
}

// `autoGenerateSnapshots` used to live here. It was DELETED, not repointed.
//
// It upserted `citation_snapshots` on the same conflict key as
// `calculateCitationSnapshots` — (brand_id, scan_date, engine, category,
// language) — but wrote the aggregate row with `avg_position: null` and
// `competitor_rates: {}` as hardcoded literals. A Supabase upsert replaces the
// full column set rather than merging, so whichever writer ran last won, and
// this one always lost information.
//
// It was reachable from three unguarded API entry points, one of which looped
// every brand the caller could write to. An assessment against production
// found the damage had not yet fired only because its single caller sits on a
// dashboard page with no inbound links.
//
// The replacement is `backfillSnapshotsForRange` in services/citation-snapshots,
// which derives the same date list and delegates to the writer that actually
// computes those fields. One table, one writer. `npm run check:writers`
// enforces that.
