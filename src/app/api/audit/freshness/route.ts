import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkFreshness } from '@/lib/audit/generators'
import { requireUser, rateLimitGate, isValidHttpUrl } from '@/lib/api-auth'
import { firstZodMessage } from '@/lib/validations'
import { SsrfError } from '@/lib/utils/safe-fetch'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const freshnessBodySchema = z.object({
  url: z.string().refine(isValidHttpUrl, 'A valid http(s) URL is required'),
})

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  const limited = await rateLimitGate(req, 'audit-freshness', 10)
  if (limited) return limited

  try {
    const parsed = freshnessBodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 400 })
    }
    const { url } = parsed.data

    const result = await checkFreshness(url)
    return NextResponse.json({ freshness: result })
  } catch (err) {
    if (err instanceof SsrfError) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 })
    }
    logger.error('Freshness check error', { err })
    return NextResponse.json({ error: 'Freshness check failed' }, { status: 500 })
  }
}
