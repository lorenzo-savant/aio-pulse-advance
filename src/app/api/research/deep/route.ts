// PATH: src/app/api/research/deep/route.ts
//
// POST /api/research/deep
//   body: { topic: string, language?: 'en'|'it'|'sv', maxSources?: number }
//   returns: { success, data: { report, sources, subQuestions, provider, model } }
//
// Deep-research report — native-TS gpt-researcher pattern (planner →
// execution → publisher). Each call is expensive (LLM + Brave + page fetches),
// so it is user-authenticated and rate-limited at 5/min.

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser, rateLimitGate } from '@/lib/api-auth'
import { runDeepResearch } from '@/lib/services/deep-research'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  topic: z.string().min(5).max(500),
  language: z.enum(['en', 'it', 'sv']).optional(),
  maxSources: z.number().int().min(1).max(12).optional(),
})

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  // Expensive LLM pipeline — 5/min/user is a generous human-paced budget.
  const rl = await rateLimitGate(req, `deep-research:${userId}`, 5)
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

  try {
    const result = await runDeepResearch(parsed.data.topic, {
      language: parsed.data.language,
      maxSources: parsed.data.maxSources,
    })
    return NextResponse.json({ success: true, data: result, timestamp: Date.now() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // "No LLM provider configured" is a deployment condition, not a crash.
    const isConfig = /no llm provider configured/i.test(msg)
    logger.error('/api/research/deep failed', { err: msg })
    return err(
      isConfig ? 'LLM providers are not configured' : 'Failed to run deep research',
      isConfig ? 503 : 500,
    )
  }
}
