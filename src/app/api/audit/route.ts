import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auditSite, auditArticle } from '@/lib/audit/site-audit'
import { requireUser, rateLimitGate, isValidHttpUrl } from '@/lib/api-auth'
import { firstZodMessage } from '@/lib/validations'
import { SsrfError } from '@/lib/utils/safe-fetch'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const auditBodySchema = z.object({
  url: z.string().refine(isValidHttpUrl, 'A valid http(s) URL is required'),
  type: z.enum(['site', 'article']).default('site'),
})

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  const limited = await rateLimitGate(req, 'audit', 10)
  if (limited) return limited

  try {
    const parsed = auditBodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 400 })
    }
    const { url, type } = parsed.data

    const result = type === 'article' ? await auditArticle(url) : await auditSite(url)
    return NextResponse.json({ audit: result })
  } catch (err) {
    if (err instanceof SsrfError) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 })
    }
    logger.error('Audit API error', { err })
    return NextResponse.json({ error: 'Audit failed' }, { status: 500 })
  }
}
