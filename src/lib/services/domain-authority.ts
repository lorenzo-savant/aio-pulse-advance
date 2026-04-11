import { createServerClient, type TypedSupabaseClient } from '@/lib/supabase'

interface BrandMetrics {
  brandId: string
  userId: string
  citationRate: number
  avgVisibility: number
  avgSentiment: number
  hallucinationRate: number
  mentionCount: number
  totalScans: number
  engineBreakdown: {
    engine: string
    citationRate: number
    visibility: number
  }[]
  competitorRates: Record<string, number>
  dates: string[]
}

const WEIGHTS = {
  citationRate: 0.3,
  consistency: 0.2,
  sentiment: 0.2,
  accuracy: 0.15,
  competitivePosition: 0.15,
}

export async function calculateDomainAuthority(brandId: string, userId: string): Promise<number> {
  const db = createServerClient()
  if (!db) {
    console.warn('[domain-authority] Database not configured')
    return 0
  }

  try {
    const metrics = await fetchBrandMetrics(db, brandId)
    if (!metrics) return 0

    const score = computeScore(metrics)

    // Store in brand_health_scores
    await storeScore(db, brandId, userId, score, metrics)

    return score
  } catch (error) {
    console.error('[domain-authority] Error calculating:', error)
    return 0
  }
}

async function fetchBrandMetrics(db: TypedSupabaseClient, brandId: string): Promise<BrandMetrics | null> {
  // Get snapshots for the past 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const fromDate = thirtyDaysAgo.toISOString().split('T')[0]
  const toDate = new Date().toISOString().split('T')[0]

  const { data: snapshots, error: snapError } = await db
    .from('citation_snapshots')
    .select('*')
    .eq('project_id', brandId)
    .eq('engine', 'all')
    .eq('category', 'all')
    .gte('scan_date', fromDate)
    .lte('scan_date', toDate)
    .order('scan_date', { ascending: true })

  if (snapError || !snapshots || snapshots.length === 0) {
    return null
  }

  // Get monitoring results for hallucination rate
  const { data: results, error: resultsError } = await db
    .from('monitoring_results')
    .select('id, engine, brand_mentioned, sentiment_score, has_hallucination')
    .eq('brand_id', brandId)
    .gte('created_at', thirtyDaysAgo.toISOString())

  if (resultsError) {
    console.error('[domain-authority] Results error:', resultsError)
  }

  // Get latest snapshot for competitor rates
  const latestSnapshot = snapshots[snapshots.length - 1]

  // Calculate metrics
  const totalScans = latestSnapshot?.total_prompts || 0
  const citationCount = latestSnapshot?.brand_citations || 0
  const citationRate = totalScans > 0 ? (citationCount / totalScans) * 100 : 0

  // Calculate average visibility
  const avgVisibility =
    snapshots.reduce((sum, s) => sum + (Number(s.avg_visibility) || 0), 0) / snapshots.length

  // Calculate average sentiment
  const sentimentResults =
    results?.filter((r) => r.brand_mentioned && r.sentiment_score != null) || []
  const avgSentiment =
    sentimentResults.length > 0
      ? sentimentResults.reduce((sum, r) => sum + (Number(r.sentiment_score) || 0), 0) /
        sentimentResults.length
      : 0

  // Calculate hallucination rate
  const hallucinationResults = results?.filter((r) => r.brand_mentioned) || []
  const hallucinationRate =
    hallucinationResults.length > 0
      ? hallucinationResults.filter((r) => r.has_hallucination).length /
        hallucinationResults.length
      : 0

  // Calculate engine consistency (how evenly distributed across engines)
  const engineRates: Record<string, number> = {}
  for (const snap of snapshots) {
    const { data: engSnaps } = await db
      .from('citation_snapshots')
      .select('engine, citation_rate')
      .eq('project_id', brandId)
      .eq('scan_date', snap.scan_date)
      .neq('engine', 'all')

    if (engSnaps) {
      for (const eng of engSnaps) {
        engineRates[eng.engine] = (engineRates[eng.engine] || 0) + (eng.citation_rate ?? 0)
      }
    }
  }
  const engineBreakdown = Object.entries(engineRates).map(([engine, rate]) => ({
    engine,
    citationRate: rate / snapshots.length,
    visibility: rate / snapshots.length,
  }))

  // Calculate consistency (standard deviation - lower is more consistent)
  const rates = engineBreakdown.map((e) => e.citationRate)
  const mean = rates.reduce((a, b) => a + b, 0) / (rates.length || 1)
  const variance =
    rates.length > 1 ? rates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rates.length : 0
  const stdDev = Math.sqrt(variance)
  const maxStdDev = 50 // Assume max std dev of 50%
  const consistency = Math.max(0, 100 - (stdDev / maxStdDev) * 100)

  return {
    brandId,
    userId: '',
    citationRate,
    avgVisibility,
    avgSentiment,
    hallucinationRate,
    mentionCount: citationCount,
    totalScans,
    engineBreakdown,
    competitorRates: (latestSnapshot?.competitor_rates as Record<string, number>) || {},
    dates: snapshots.map((s) => s.scan_date),
  }
}

function computeScore(metrics: BrandMetrics): number {
  // 1. Citation Rate (0-100)
  const citationScore = Math.min(100, metrics.citationRate)

  // 2. Consistency across engines (0-100)
  const rates = metrics.engineBreakdown.map((e) => e.citationRate)
  const mean = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
  const variance =
    rates.length > 1 ? rates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rates.length : 0
  const stdDev = Math.sqrt(variance)
  const consistencyScore = Math.max(0, 100 - (stdDev / 25) * 100)

  // 3. Sentiment normalized (-1 to 1 → 0-100)
  const sentimentScore = ((metrics.avgSentiment + 1) / 2) * 100

  // 4. Accuracy (1 - hallucination_rate) * 100
  const accuracyScore = (1 - metrics.hallucinationRate) * 100

  // 5. Competitive position (compare to competitors)
  const competitorValues = Object.values(metrics.competitorRates)
  let competitiveScore = 50 // default neutral
  if (competitorValues.length > 0) {
    const avgCompetitorRate = competitorValues.reduce((a, b) => a + b, 0) / competitorValues.length
    const diff = metrics.citationRate - avgCompetitorRate
    competitiveScore = 50 + Math.min(50, Math.max(-50, diff))
  }

  // Weighted sum
  const da =
    citationScore * WEIGHTS.citationRate +
    consistencyScore * WEIGHTS.consistency +
    sentimentScore * WEIGHTS.sentiment +
    accuracyScore * WEIGHTS.accuracy +
    competitiveScore * WEIGHTS.competitivePosition

  return Math.round(da * 10) / 10 // Round to 1 decimal
}

async function storeScore(
  db: TypedSupabaseClient,
  brandId: string,
  userId: string,
  score: number,
  metrics: BrandMetrics,
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

  await db.from('brand_health_scores').upsert(
    {
      brand_id: brandId,
      user_id: userId,
      date: today,
      visibility_score: metrics.avgVisibility,
      sentiment_score: metrics.avgSentiment,
      hallucination_rate: metrics.hallucinationRate,
      mention_count: metrics.mentionCount,
      citation_count: metrics.mentionCount,
      health_score: metrics.citationRate,
      domain_authority: score,
      engine_breakdown: metrics.engineBreakdown,
    },
    {
      onConflict: 'brand_id,date',
    },
  )
}

export async function getDomainAuthority(brandId: string): Promise<number> {
  const db = createServerClient()
  if (!db) return 0

  const { data, error } = await db
    .from('brand_health_scores')
    .select('domain_authority')
    .eq('brand_id', brandId)
    .order('date', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return 0
  return (data as { domain_authority?: number }).domain_authority || 0
}
