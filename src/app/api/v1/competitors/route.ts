import { type NextRequest, NextResponse } from 'next/server'
import { verifyApiKey, publicApiRateLimit } from '@/lib/services/public-api'
import { createServerClient } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-utils'
import { requireBrandRole, getAccessibleBrandIds } from '@/lib/authorize'

function successResponse(data: unknown) {
  return NextResponse.json({ success: true, data, timestamp: Date.now() })
}

function errorResponse(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function rateLimitResponse(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  return NextResponse.json(
    { success: false, error: 'Rate limit exceeded' },
    { status: 429, headers: { 'Retry-After': String(retryAfter), 'X-RateLimit-Remaining': '0' } },
  )
}

export const GET = withApiHandler('v1/competitors', async (req: NextRequest) => {
  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey) return errorResponse('Missing X-API-Key header', 401)

  const userId = await verifyApiKey(apiKey)
  if (!userId) return errorResponse('Invalid API key', 401)

  const rl = await publicApiRateLimit(userId)
  if (!rl.success) return rateLimitResponse(rl.resetAt)

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10) || 10, 50)

  const db = createServerClient()
  if (!db) return errorResponse('Database not configured', 503)

  if (brandId) {
    const gate = await requireBrandRole(brandId, userId, 'viewer')
    if ('response' in gate) return errorResponse('Brand not found', 404)

    const { data, error } = await db
      .from('competitor_analyses')
      .select('id, brand_id, primary_url, competitors, summary, created_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return errorResponse(error.message)
    return successResponse(data || [])
  }

  // No brand given — every analysis across the brands this key can reach.
  // Empty scope is a real answer (the key has no brands), not an error to push
  // through PostgREST's `.in()` serialization.
  const accessibleBrandIds = await getAccessibleBrandIds(db, userId)
  if (accessibleBrandIds.length === 0) {
    return successResponse([])
  }
  const { data, error } = await db
    .from('competitor_analyses')
    .select('id, brand_id, primary_url, competitors, summary, created_at')
    .in('brand_id', accessibleBrandIds)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return errorResponse(error.message)
  return successResponse(data || [])
})
