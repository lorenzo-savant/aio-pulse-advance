// PATH: src/lib/services/work-orders.ts
import { createServerClient } from '@/lib/supabase'
import { calculateGeoScore } from './geo-score'
import { logger } from '@/lib/logger'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Current GEO score for a brand, computed from its most recent health row.
 * Used to snapshot a work order's baseline (at creation) and recheck (at
 * completion) so we can attribute GEO movement to the action. Returns null
 * when there's no health data yet.
 */
export async function currentGeoScore(brandId: string): Promise<number | null> {
  const db = createServerClient()
  if (!db) return null
  try {
    const { data } = await (db as any)
      .from('brand_health_scores')
      .select(
        'citation_rate, mention_rate, visibility_score, recommendation_rate, sentiment_score, position_avg, hallucination_rate',
      )
      .eq('brand_id', brandId)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data) return null
    return calculateGeoScore({
      citationRate: data.citation_rate ?? 0,
      mentionRate: data.mention_rate ?? data.visibility_score ?? 0,
      recommendationRate: data.recommendation_rate ?? 0,
      sentimentScore: data.sentiment_score ?? 0,
      positionAvg: data.position_avg ?? 0,
      hallucinationRate: data.hallucination_rate ?? 0,
    }).score
  } catch (e) {
    logger.warn('work-orders: currentGeoScore failed', { err: String(e) })
    return null
  }
}
