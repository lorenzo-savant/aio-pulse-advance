// PATH: src/app/api/advisor/route.ts
//
// POST /api/advisor
//   body: { brand_id: string, question?: string }
//   returns: { success, data: { context, strategy, provider, model } }
//
// GET /api/advisor?brand_id=xxx&limit=5
//   returns: { success, data: [ { id, summary, confidence, created_at, question } ] }
//
// Thin auth+access wrapper around src/lib/services/advisor.ts. The actual
// strategy reasoning lives in the service so it stays testable. Rate-limited
// because each call is an LLM call.

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser, rateLimitGate } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { getAdvisorRecommendation, getAdvisorHistory } from '@/lib/services/advisor'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  brand_id: z.string().uuid(),
  question: z.string().min(3).max(500).optional(),
  /** Output language for the advice. Defaults to the brand's language. */
  language: z.enum(['en', 'it', 'sv']).optional(),
})

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  // Each call hits an LLM. 10/min/user is plenty for human-paced advising.
  const rl = await rateLimitGate(req, `advisor:${userId}`, 10)
  if (rl) return rl

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return err(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '), 400)
  }

  if (!(await verifyBrandAccess(parsed.data.brand_id, userId))) {
    return err('Brand not found or access denied', 404)
  }

  try {
    const result = await getAdvisorRecommendation(
      parsed.data.brand_id,
      parsed.data.question,
      userId,
      parsed.data.language,
    )
    return NextResponse.json({ success: true, data: result, timestamp: Date.now() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('/api/advisor failed', { err: msg })
    return err(msg, 500)
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const limit = Math.min(Number(searchParams.get('limit')) || 5, 20)

  if (!brandId) return err('brand_id is required', 400)

  if (!(await verifyBrandAccess(brandId, userId))) {
    return err('Brand not found or access denied', 404)
  }

  try {
    const history = await getAdvisorHistory(brandId, limit)
    return NextResponse.json({ success: true, data: history })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('/api/advisor GET failed', { err: msg })
    return err(msg, 500)
  }
}
