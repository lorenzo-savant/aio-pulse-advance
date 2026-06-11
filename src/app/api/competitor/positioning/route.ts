// PATH: src/app/api/competitor/positioning/route.ts
//
// POST /api/competitor/positioning  { domain, name? }
// → "claims vs. documented reality" analysis for a competitor: fetches its
//   pricing/docs/changelog (SSRF-hardened safeFetch) and uses the resilient
//   free-first LLM chain to surface contradictions. No new API key.

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserId, AuthError } from '@/lib/supabase'
import { analyzeCompetitorPositioning } from '@/lib/services/competitor-positioning'
import { firstZodMessage } from '@/lib/validations'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const positioningBodySchema = z.object({
  domain: z.string().min(1, 'domain is required').max(255),
  name: z.string().max(255).optional(),
})

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function POST(req: NextRequest) {
  try {
    await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError) return err(e.message, 401)
    return err('Authentication failed', 401)
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const parsed = positioningBodySchema.safeParse(rawBody)
  if (!parsed.success) return err(firstZodMessage(parsed.error), 400)
  const domain = parsed.data.domain.trim()
  if (!domain) return err('domain is required', 400)

  try {
    const data = await analyzeCompetitorPositioning(domain, parsed.data.name?.trim() || undefined)
    return NextResponse.json({ success: true, data, timestamp: Date.now() })
  } catch (e) {
    logger.error('/api/competitor/positioning failed', { err: String(e) })
    return err('Failed to analyze competitor positioning')
  }
}
