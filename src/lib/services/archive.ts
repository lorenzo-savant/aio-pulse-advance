// PATH: src/lib/services/archive.ts
// Archive service for creating research archives from tool results

import { createServerClient } from '@/lib/supabase'

export type QueryType =
  | 'content_audit'
  | 'content_optimizer'
  | 'engine_monitor'
  | 'competitor_analysis'
  | 'sentiment_analysis'
  | 'citations'
  | 'snapshot'

export interface CreateArchiveParams {
  brandId: string
  organizationId: string
  userId: string
  queryType: QueryType
  toolSection: string
  queryText: string
  aiModelUsed?: string
  aiModelVersion?: string
  queryParameters?: Record<string, unknown>
  resultsJson: Record<string, unknown>
  extractedRecommendations?: string[]
  notes?: string
  tags?: string[]
}

export async function createResearchArchive(params: CreateArchiveParams) {
  const db = createServerClient()
  if (!db) {
    throw new Error('Database not configured')
  }
  const dbAny = db as any

  const { data, error } = await dbAny
    .from('research_archives')
    .insert({
      brand_id: params.brandId,
      organization_id: params.organizationId,
      query_type: params.queryType,
      tool_section: params.toolSection,
      query_text: params.queryText,
      query_hash: params.queryText
        ? Buffer.from(params.queryText).toString('base64').slice(0, 64)
        : '',
      ai_model_used: params.aiModelUsed || 'claude-3-5-sonnet',
      ai_model_version: params.aiModelVersion,
      query_parameters: params.queryParameters || {},
      results_json: params.resultsJson,
      extracted_recommendations: params.extractedRecommendations || [],
      user_id: params.userId,
      notes: params.notes,
      tags: params.tags || [],
      status: 'active',
      query_date: new Date().toISOString().split('T')[0],
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function createRecommendationFromArchive(
  archiveId: string,
  brandId: string,
  organizationId: string,
  recommendationText: string,
  category: string,
  priority: 'high' | 'medium' | 'low' = 'medium',
  userId: string,
) {
  const db = createServerClient()
  if (!db) {
    throw new Error('Database not configured')
  }
  const dbAny = db as any

  // Check for existing similar recommendation (fuzzy match)
  const { data: existing } = await dbAny
    .from('recommendation_tracking')
    .select('id, occurrence_count, appearance_dates')
    .eq('brand_id', brandId)
    .eq('status', 'active')
    .ilike('recommendation_text', `%${recommendationText.slice(0, 50)}%`)
    .limit(1)
    .single()

  if (existing) {
    // Update existing recommendation
    const { error } = await dbAny
      .from('recommendation_tracking')
      .update({
        last_seen_date: new Date().toISOString().split('T')[0],
        occurrence_count: (existing.occurrence_count || 0) + 1,
        appearance_dates: [
          ...(existing.appearance_dates || []),
          new Date().toISOString().split('T')[0],
        ],
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (error) throw error
    return existing.id
  }

  // Create new recommendation
  const { data, error } = await dbAny
    .from('recommendation_tracking')
    .insert({
      archive_id: archiveId,
      brand_id: brandId,
      organization_id: organizationId,
      recommendation_text: recommendationText,
      recommendation_hash: Buffer.from(recommendationText).toString('base64').slice(0, 64),
      category,
      priority,
      first_seen_date: new Date().toISOString().split('T')[0],
      last_seen_date: new Date().toISOString().split('T')[0],
      occurrence_count: 1,
      appearance_dates: [new Date().toISOString().split('T')[0]],
      user_created_id: userId,
      status: 'active',
    })
    .select()
    .single()

  if (error) throw error
  return data?.id
}

export async function createSentimentRecord(
  brandId: string,
  organizationId: string,
  sentimentScore: number,
  sentimentTrend: 'improving' | 'declining' | 'stable',
  positiveMentions: number,
  negativeMentions: number,
  neutralMentions: number,
  sourceTool?: string,
) {
  const db = createServerClient()
  if (!db) {
    throw new Error('Database not configured')
  }
  const dbAny = db as any

  const { data, error } = await dbAny
    .from('sentiment_history')
    .upsert(
      {
        brand_id: brandId,
        organization_id: organizationId,
        sentiment_score: sentimentScore,
        sentiment_trend: sentimentTrend,
        positive_mentions: positiveMentions,
        negative_mentions: negativeMentions,
        neutral_mentions: neutralMentions,
        source_tool: sourceTool,
        snapshot_date: new Date().toISOString().split('T')[0],
      },
      {
        onConflict: 'brand_id,snapshot_date',
      },
    )
    .select()
    .single()

  if (error) throw error
  return data
}

export async function upsertBrandSnapshot(brandId: string, organizationId: string) {
  const db = createServerClient()
  if (!db) {
    throw new Error('Database not configured')
  }
  const dbAny = db as any

  // Get latest sentiment
  const { data: sentiment } = await dbAny
    .from('sentiment_history')
    .select('sentiment_score')
    .eq('brand_id', brandId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single()

  // Get recommendation stats
  const { count: totalRecs } = await dbAny
    .from('recommendation_tracking')
    .select('*', { count: 'exact', head: true })
    .eq('brand_id', brandId)
    .eq('status', 'active')

  const { count: completedRecs } = await dbAny
    .from('recommendation_tracking')
    .select('*', { count: 'exact', head: true })
    .eq('brand_id', brandId)
    .eq('status', 'active')
    .eq('implementation_status', 'completed')

  // Get query count
  const { count: queryCount } = await dbAny
    .from('research_archives')
    .select('*', { count: 'exact', head: true })
    .eq('brand_id', brandId)
    .eq('status', 'active')

  // Calculate health score
  const sentimentNorm = ((sentiment?.sentiment_score || 0) + 100) / 2
  const completionRate = totalRecs && completedRecs ? (completedRecs / totalRecs) * 100 : 0
  const healthScore =
    sentimentNorm * 0.35 + completionRate * 0.35 + Math.min((queryCount || 0) * 10, 100) * 0.2 + 50

  const { data, error } = await dbAny
    .from('brand_snapshots')
    .upsert(
      {
        brand_id: brandId,
        organization_id: organizationId,
        snapshot_date: new Date().toISOString().split('T')[0],
        health_score: Math.round(healthScore * 100) / 100,
        sentiment_score: sentiment?.sentiment_score || 0,
        total_recommendations: totalRecs || 0,
        completed_recommendations: completedRecs || 0,
        pending_recommendations: (totalRecs || 0) - (completedRecs || 0),
        queries_this_period: queryCount || 0,
      },
      {
        onConflict: 'brand_id,snapshot_date',
      },
    )
    .select()
    .single()

  if (error) throw error
  return data
}
