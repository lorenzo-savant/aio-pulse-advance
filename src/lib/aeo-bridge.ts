import { createServerClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export interface AeoEngineStats {
  score: number
  mention_rate: number
  scan_count: number
}

export interface AeoVisibility {
  ai_score: number
  mention_rate: number
  total_scans: number
  by_engine: Record<string, AeoEngineStats>
  trend_direction: 'up' | 'down' | 'stable'
  hallucination_rate: number
}

export interface AeoSentiment {
  overall: 'positive' | 'negative' | 'neutral'
  score: number
  by_engine: Record<string, { score: number; label: string }>
  breakdown: { positive: number; negative: number; neutral: number }
}

export interface AeoCompetitor {
  name: string
  domain: string
  ai_score: number
  mention_rate: number
  strengths: string[]
  weaknesses: string[]
}

export interface AeoCitation {
  url: string
  domain: string
  mention_count: number
  citation_type: string
}

export interface AeoRecommendation {
  id: string
  type: string
  priority: string
  title: string
  description: string
  status: string
}

export interface AeoResultSample {
  date: string
  engine: string
  prompt: string
  brand_mentioned: boolean
  visibility_score: number
  sentiment: string | null
  mention_position: number | null
}

export interface AeoReportJson {
  meta: {
    client: string
    domain: string | null
    report_date: string
    report_version: string
    generated_by: string
    date_range_days: number
    completeness_score: number
    trigger: 'manual' | 'cron'
  }
  visibility: AeoVisibility
  sentiment: AeoSentiment
  competitors: AeoCompetitor[]
  citations: AeoCitation[]
  recommendations: AeoRecommendation[]
  raw_results_sample: AeoResultSample[]
  brand_config: {
    name: string
    domain: string | null
    competitors: string[]
    industry: string | null
    aliases: string[]
  }
  warnings: string[]
}

export interface AggregatedBrandData {
  results: Record<string, unknown>[]
  health: Record<string, unknown> | null
  competitors: Record<string, unknown>[]
  recommendations: Record<string, unknown>[]
  citations: Record<string, unknown>[]
}

export function calcVisibilityScore(results: Record<string, unknown>[]): number {
  if (!results.length) return 0
  const avg =
    results.reduce((s, r) => s + ((r.visibility_score as number) ?? 0), 0) / results.length
  return Math.round(avg)
}

export function calcMentionRate(results: Record<string, unknown>[]): number {
  if (!results.length) return 0
  const mentioned = results.filter((r) => r.brand_mentioned).length
  return Math.round((mentioned / results.length) * 1000) / 10
}

export function aggregateByEngine(
  results: Record<string, unknown>[],
): Record<string, AeoEngineStats> {
  const engines: Record<string, { score: number; mentioned: number; total: number }> = {}
  for (const r of results) {
    const e = (r.engine as string) || 'unknown'
    if (!engines[e]) engines[e] = { score: 0, mentioned: 0, total: 0 }
    engines[e].total++
    engines[e].score += (r.visibility_score as number) ?? 0
    if (r.brand_mentioned) engines[e].mentioned++
  }
  return Object.fromEntries(
    Object.entries(engines).map(([engine, s]) => [
      engine,
      {
        score: s.total > 0 ? Math.round(s.score / s.total) : 0,
        mention_rate: s.total > 0 ? Math.round((s.mentioned / s.total) * 1000) / 10 : 0,
        scan_count: s.total,
      },
    ]),
  )
}

export function calcSentimentBreakdown(results: Record<string, unknown>[]) {
  const breakdown = { positive: 0, negative: 0, neutral: 0 }
  for (const r of results) {
    if (r.sentiment === 'positive') breakdown.positive++
    else if (r.sentiment === 'negative') breakdown.negative++
    else breakdown.neutral++
  }
  return breakdown
}

export function calcOverallSentiment(results: Record<string, unknown>[]): {
  overall: 'positive' | 'negative' | 'neutral'
  score: number
} {
  if (!results.length) return { overall: 'neutral', score: 0 }
  const avg = results.reduce((s, r) => s + ((r.sentiment_score as number) ?? 0), 0) / results.length
  const rounded = Math.round(avg * 100) / 100
  return {
    overall: rounded > 0.1 ? 'positive' : rounded < -0.1 ? 'negative' : 'neutral',
    score: rounded,
  }
}

export function calcCompleteness(
  brand: Record<string, unknown>,
  results: Record<string, unknown>[],
  health: Record<string, unknown> | null,
  competitors: Record<string, unknown>[],
  citations: Record<string, unknown>[],
  recommendations: Record<string, unknown>[],
): number {
  let score = 0
  if (brand.domain) score += 15
  if (results.length > 0) score += 25
  if (results.length >= 10) score += 10
  if (health) score += 15
  if (competitors.length > 0) score += 15
  if (citations.length > 0) score += 10
  if (recommendations.length > 0) score += 10
  return Math.min(score, 100)
}

export function buildAeoReportJson(params: {
  brand: Record<string, unknown>
  results: Record<string, unknown>[]
  health: Record<string, unknown> | null
  competitors: Record<string, unknown>[]
  recommendations: Record<string, unknown>[]
  citations: Record<string, unknown>[]
  dateRangeDays: number
  trigger: 'manual' | 'cron'
}): AeoReportJson {
  const {
    brand,
    results,
    health,
    competitors,
    recommendations,
    citations,
    dateRangeDays,
    trigger,
  } = params

  const byEngine = aggregateByEngine(results)
  const mentionRate = calcMentionRate(results)
  const visibilityScore = health?.visibility_score
    ? Math.round(health.visibility_score as number)
    : calcVisibilityScore(results)
  const sentimentData = calcOverallSentiment(results)
  const breakdown = calcSentimentBreakdown(results)
  const completeness = calcCompleteness(
    brand,
    results,
    health,
    competitors,
    citations,
    recommendations,
  )

  let trendDirection: 'up' | 'down' | 'stable' = 'stable'
  if (results.length >= 4) {
    const mid = Math.floor(results.length / 2)
    const firstHalf = results.slice(mid)
    const secondHalf = results.slice(0, mid)
    const avgFirst = calcVisibilityScore(firstHalf)
    const avgSecond = calcVisibilityScore(secondHalf)
    const diff = avgSecond - avgFirst
    if (diff > 3) trendDirection = 'up'
    else if (diff < -3) trendDirection = 'down'
  }

  return {
    meta: {
      client: brand.name as string,
      domain: brand.domain as string | null,
      report_date:
        new Date().toISOString().split('T')[0] ?? new Date().toISOString().substring(0, 10),
      report_version: '1.0',
      generated_by: 'AIO Pulse',
      date_range_days: dateRangeDays,
      completeness_score: completeness,
      trigger,
    },
    visibility: {
      ai_score: visibilityScore,
      mention_rate: mentionRate,
      total_scans: results.length,
      by_engine: byEngine,
      trend_direction: trendDirection,
      hallucination_rate: (health?.hallucination_rate as number) ?? 0,
    },
    sentiment: {
      overall: sentimentData.overall,
      score: sentimentData.score,
      by_engine: Object.fromEntries(
        Object.entries(byEngine).map(([engine]) => {
          const engineResults = results.filter((r) => r.engine === engine)
          const es = calcOverallSentiment(engineResults)
          return [engine, { score: es.score, label: es.overall }]
        }),
      ),
      breakdown,
    },
    competitors: competitors.map((c) => ({
      name: (c.competitor_name ?? c.name ?? '') as string,
      domain: (c.competitor_domain ?? c.domain ?? '') as string,
      ai_score: (c.visibility_score ?? 0) as number,
      mention_rate: (c.mention_rate ?? 0) as number,
      strengths: (c.strengths ?? []) as string[],
      weaknesses: (c.weaknesses ?? []) as string[],
    })),
    citations: citations.map((c) => ({
      url: (c.url ?? '') as string,
      domain: (c.domain ?? '') as string,
      mention_count: (c.mention_count ?? 0) as number,
      citation_type: (c.citation_type ?? 'organic') as string,
    })),
    recommendations: recommendations.map((r) => ({
      id: r.id as string,
      type: (r.type ?? '') as string,
      priority: (r.priority ?? 'medium') as string,
      title: (r.title ?? '') as string,
      description: (r.description ?? '') as string,
      status: (r.status ?? 'pending') as string,
    })),
    raw_results_sample: results.slice(0, 50).map((r) => ({
      date: (r.created_at as string) ?? '',
      engine: (r.engine as string) ?? '',
      prompt: ((r.prompt_text as string) ?? '').substring(0, 200),
      brand_mentioned: Boolean(r.brand_mentioned),
      visibility_score: (r.visibility_score as number) ?? 0,
      sentiment: (r.sentiment as string | null) ?? null,
      mention_position: (r.mention_position as number | null) ?? null,
    })),
    brand_config: {
      name: brand.name as string,
      domain: brand.domain as string | null,
      competitors: (brand.competitors ?? []) as string[],
      industry: (brand.industry ?? null) as string | null,
      aliases: (brand.aliases ?? []) as string[],
    },
    warnings: [],
  }
}

export async function sendToAeo(params: {
  clientDomain: string
  reportJson: AeoReportJson
  aioVisibilityScore: number
}): Promise<{ success: boolean; runId?: string; error?: string }> {
  const aeoUrl = process.env.AEO_SUPABASE_URL
  const aeoKey = process.env.AEO_SUPABASE_KEY

  if (!aeoUrl || !aeoKey) {
    return { success: false, error: 'AEO_SUPABASE_URL or AEO_SUPABASE_KEY not configured' }
  }

  const aeoSupabase = createClient(aeoUrl, aeoKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: client, error: clientError } = await aeoSupabase
    .from('clients')
    .select('id')
    .eq('domain', params.clientDomain)
    .single()

  if (clientError || !client) {
    return { success: false, error: `Client not found for domain: ${params.clientDomain}` }
  }

  const { data: run, error: runError } = await aeoSupabase
    .from('aeo_runs')
    .insert({
      client_id: (client as { id: string }).id,
      status: 'pending',
      report_json: params.reportJson as unknown as Record<string, unknown>,
      ai_visibility_score_before: params.aioVisibilityScore,
    })
    .select('id')
    .single()

  if (runError || !run) {
    return { success: false, error: runError?.message ?? 'Failed to insert aeo_run' }
  }

  return { success: true, runId: (run as { id: string }).id }
}

export async function aggregateBrandData(
  brandId: string,
  dateRangeDays: number = 30,
): Promise<AggregatedBrandData> {
  const db = createServerClient()
  if (!db) throw new Error('Database not configured')

  const fromDate = new Date(Date.now() - dateRangeDays * 24 * 60 * 60 * 1000).toISOString()

  const [resultsRes, healthRes, competitorsRes, recommendationsRes, citationsRes] =
    await Promise.all([
      db
        .from('monitoring_results')
        .select(
          'engine, brand_mentioned, visibility_score, sentiment, sentiment_score, mention_position, prompt_text, created_at, has_hallucination',
        )
        .eq('brand_id', brandId)
        .gte('created_at', fromDate)
        .order('created_at', { ascending: false })
        .limit(500),

      db
        .from('brand_health_scores')
        .select('*')
        .eq('brand_id', brandId)
        .order('date', { ascending: false })
        .limit(1)
        .single(),

      db
        .from('competitor_analyses')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(10),

      db
        .from('recommendation_history')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(20),

      db
        .from('citation_snapshots')
        .select('*')
        .eq('brand_id', brandId)
        .order('mention_count', { ascending: false })
        .limit(20),
    ])

  return {
    results: (resultsRes.data ?? []) as Record<string, unknown>[],
    health: (healthRes.data as Record<string, unknown> | null) ?? null,
    competitors: (competitorsRes.data ?? []) as Record<string, unknown>[],
    recommendations: (recommendationsRes.data ?? []) as Record<string, unknown>[],
    citations: (citationsRes.data ?? []) as Record<string, unknown>[],
  }
}
