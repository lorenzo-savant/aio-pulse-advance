// PATH: src/app/api/advisor/route.ts
//
// POST /api/advisor
//   body: { brand_id: string, question?: string }
//   returns: { success, data: { context, strategy, provider, model } }
//
// Thin auth+access wrapper around src/lib/services/advisor.ts. The actual
// strategy reasoning lives in the service so it stays testable. Rate-limited
// because each call is an LLM call.

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser, rateLimitGate } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { getAdvisorRecommendation } from '@/lib/services/advisor'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  brand_id: z.string().uuid(),
  question: z.string().min(3).max(500).optional(),
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
    const result = await getAdvisorRecommendation(parsed.data.brand_id, parsed.data.question)
    return NextResponse.json({ success: true, data: result, timestamp: Date.now() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('/api/advisor failed', { err: msg })
    // Most expected failure modes — surface the message so the caller can act
    // (e.g. "No LLM provider configured", "Strategist returned non-JSON output").
    return err(msg, 500)
  }
}
