// PATH: src/app/api/themes/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import type { Json } from '@/types/database'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { embedTexts } from '@/lib/services/semantic'
import { clusterResponses, type ClusterInput } from '@/lib/services/response-clustering'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */

// Cap how many uncached responses we embed per request (one batched API call)
// to bound latency + cost. Subsequent requests reuse the cache.
const MAX_EMBED_PER_REQUEST = 80
const MAX_RESPONSES = 250

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// ─── GET /api/themes?brand_id=&days= — themes AI associates with the brand ───
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const days = Math.min(365, Math.max(1, Number(searchParams.get('days')) || 90))
  if (!brandId) return err('brand_id is required', 400)
  if (!(await verifyBrandAccess(brandId, userId)))
    return err('Brand not found or access denied', 404)

  const since = new Date()
  since.setDate(since.getDate() - days)

  try {
    // Responses that actually mention the brand are the relevant ones for
    // "what themes the AI associates with you".
    const { data: rows, error } = await (db as any)
      .from('monitoring_results')
      .select('id, response_text, sentiment_score, brand_mentioned, created_at')
      .eq('brand_id', brandId)
      .eq('brand_mentioned', true)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(MAX_RESPONSES)
    if (error) {
      logger.warn('/api/themes responses query failed', { err: String(error) })
      return NextResponse.json({ success: true, data: { themes: [], analyzed: 0 } })
    }
    const responses = (
      (rows ?? []) as Array<{
        id: string
        response_text: string | null
        sentiment_score: number | null
      }>
    ).filter((r) => (r.response_text || '').trim().length > 0)

    if (responses.length === 0) {
      return NextResponse.json({ success: true, data: { themes: [], analyzed: 0 } })
    }

    // Load cached embeddings; embed the rest in one batched call (best-effort).
    const ids = responses.map((r) => r.id)
    let cached: Record<string, number[]> = {}
    try {
      const { data: emb } = await (db as any)
        .from('response_embeddings')
        .select('monitoring_result_id, embedding')
        .in('monitoring_result_id', ids)
      for (const e of (emb ?? []) as Array<{ monitoring_result_id: string; embedding: unknown }>) {
        if (Array.isArray(e.embedding)) cached[e.monitoring_result_id] = e.embedding as number[]
      }
    } catch {
      cached = {} // table may not exist yet
    }

    const toEmbed = responses.filter((r) => !cached[r.id]).slice(0, MAX_EMBED_PER_REQUEST)
    if (toEmbed.length > 0) {
      const vectors = await embedTexts(toEmbed.map((r) => r.response_text!.slice(0, 4000)))
      if (vectors) {
        const upserts: any[] = []
        toEmbed.forEach((r, i) => {
          const v = vectors[i]
          if (v) {
            cached[r.id] = v
            upserts.push({
              monitoring_result_id: r.id,
              brand_id: brandId,
              user_id: userId,
              text: r.response_text!.slice(0, 4000),
              embedding: v as unknown as Json,
              sentiment_score: r.sentiment_score,
            })
          }
        })
        if (upserts.length > 0) {
          try {
            await (db as any).from('response_embeddings').upsert(upserts)
          } catch {
            /* non-critical caching write */
          }
        }
      }
    }

    const items: ClusterInput[] = responses
      .filter((r) => cached[r.id])
      .map((r) => ({
        id: r.id,
        text: r.response_text!.slice(0, 600),
        embedding: cached[r.id]!,
        sentimentScore: r.sentiment_score,
      }))

    const themes = clusterResponses(items)

    return NextResponse.json({
      success: true,
      data: { themes, analyzed: items.length, totalMentions: responses.length },
      timestamp: Date.now(),
    })
  } catch (e) {
    logger.error('/api/themes error', { err: String(e) })
    return NextResponse.json({ success: true, data: { themes: [], analyzed: 0 } })
  }
}
