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

  // Get current period data
  const { data: currentData, error: currentError } = await (db as any)
    .from('citation_snapshots')
    .select('*')
    .eq('project_id', brandId)
    .gte('scan_date', startDate.toISOString().split('T')[0])
    .lte('scan_date', new Date().toISOString().split('T')[0])
    .order('scan_date', { ascending: true })

  // Get previous period for comparison
  const { data: previousData } = await (db as any)
    .from('citation_snapshots')
    .select('*')
    .eq('project_id', brandId)
    .gte('scan_date', previousStartDate.toISOString().split('T')[0])
    .lte('scan_date', startDate.toISOString().split('T')[0])
    .order('scan_date', { ascending: true })

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
  const { data: brand } = await (db as any)
    .from('brands')
    .select('name, competitors')
    .eq('id', brandId)
    .single()

  const competitors = brand?.competitors || []

  // Get brand snapshots
  const { data: brandSnapshots } = await (db as any)
    .from('citation_snapshots')
    .select('scan_date, citation_rate, avg_visibility')
    .eq('project_id', brandId)
    .gte('scan_date', startDate.toISOString().split('T')[0])
    .order('scan_date', { ascending: false })

  // Calculate averages
  const brandAvgCitation = calculateAverage(
    (brandSnapshots || []).map((s: any) => ({ value: s.citation_rate })),
  )
  const brandAvgVisibility = calculateAverage(
    (brandSnapshots || []).map((s: any) => ({ value: s.avg_visibility })),
  )

  return {
    brand: {
      name: brand?.name || 'Your Brand',
      avgCitation: brandAvgCitation,
      avgVisibility: brandAvgVisibility,
    },
    competitors: competitors.map((comp: string) => ({
      name: comp,
      avgCitation: Math.random() * 30 + 10, // Would come from competitor analysis
      avgVisibility: Math.random() * 50 + 20,
    })),
    period: options.period,
    snapshotCount: brandSnapshots?.length || 0,
  }
}

/**
 * Auto-generate snapshots from monitoring results
 * Call this periodically or after scans
 */
export async function autoGenerateSnapshots(brandId: string): Promise<{
  snapshotsCreated: number
  errors: string[]
}> {
  const db = createServerClient()
  if (!db) return { snapshotsCreated: 0, errors: ['Database not configured'] }

  // Get all monitoring results for this brand
  const { data: results, error } = await (db as any)
    .from('monitoring_results')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (error) return { snapshotsCreated: 0, errors: [error.message] }
  if (!results || results.length === 0) return { snapshotsCreated: 0, errors: [] }

  // Group by date
  const byDate = new Map<string, typeof results>()
  for (const r of results) {
    const dateStr = r.created_at as string | undefined
    if (!dateStr) continue
    const date = dateStr.split('T')[0] as string
    if (!date || !byDate.has(date)) {
      if (date) byDate.set(date, [])
    } else {
      byDate.get(date)!.push(r)
    }
  }

  let created = 0
  const errors: string[] = []

  // Create snapshot for each date
  for (const [date, dayResults] of byDate) {
    const totalPrompts = dayResults.length
    const brandMentions = dayResults.filter((r: any) => r.brand_mentioned).length
    const citationRate = totalPrompts > 0 ? (brandMentions / totalPrompts) * 100 : 0
    const avgVisibility =
      dayResults.reduce((sum: number, r: any) => sum + (r.visibility_score || 0), 0) / totalPrompts
    const avgSentiment =
      dayResults.reduce((sum: number, r: any) => sum + (r.sentiment_score || 0), 0) / totalPrompts

    const { error: upsertError } = await (db as any).from('citation_snapshots').upsert(
      {
        project_id: brandId,
        scan_date: date,
        engine: 'all',
        category: 'all',
        language: 'all',
        total_prompts: totalPrompts,
        brand_citations: brandMentions,
        citation_rate: Math.round(citationRate * 100) / 100,
        avg_position: null,
        avg_visibility: Math.round(avgVisibility * 100) / 100,
        avg_sentiment: Math.round(avgSentiment * 100) / 100,
        competitor_rates: {},
      },
      {
        onConflict: 'project_id,scan_date,engine,category,language',
      },
    )

    if (upsertError) {
      errors.push(`${date}: ${upsertError.message}`)
    } else {
      created++
    }
  }

  return { snapshotsCreated: created, errors }
}
