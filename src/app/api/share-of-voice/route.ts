// PATH: src/app/api/share-of-voice/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { logger } from '@/lib/logger'
import { computeShareOfVoice, type SovInputRow } from '@/lib/services/share-of-voice'

export const dynamic = 'force-dynamic'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// ─── GET /api/share-of-voice — brand vs competitor mention share ─────────────
// Query: brand_id (required), days (default 30, max 365), bucket (day|week)
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const days = Math.min(365, Math.max(1, Number(searchParams.get('days')) || 30))
  const bucket = searchParams.get('bucket') === 'week' ? 'week' : 'day'

  if (!brandId) return err('brand_id is required', 400)

  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  const since = new Date()
  since.setDate(since.getDate() - days)

  try {
    const { data, error } = await (
      db as unknown as ReturnType<typeof createServerClient> & { from: (t: string) => any }
    )
      .from('monitoring_results')
      .select('brand_mentioned, mention_count, mention_position, competitor_mentions, created_at')
      .eq('brand_id', brandId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })
      .limit(5000)

    if (error) {
      logger.error('/api/share-of-voice query failed', { err: error })
      return err('Failed to load share-of-voice data')
    }

    const sov = computeShareOfVoice((data ?? []) as SovInputRow[], brand.name, { bucket })

    return NextResponse.json({ success: true, data: sov, timestamp: Date.now() })
  } catch (e) {
    logger.error('/api/share-of-voice error', { err: String(e) })
    return err('Failed to compute share of voice')
  }
}
