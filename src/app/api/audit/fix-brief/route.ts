import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateFixBrief, formatFixBriefAsMarkdown } from '@/lib/audit/fix-brief'
import { auditSite, auditArticle } from '@/lib/audit/site-audit'
import { requireUser, rateLimitGate, isValidHttpUrl } from '@/lib/api-auth'
import { firstZodMessage } from '@/lib/validations'
import { SsrfError } from '@/lib/utils/safe-fetch'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const fixBriefBodySchema = z
  .object({
    url: z.string().optional(),
    type: z.enum(['site', 'article']).default('site'),
    // Pre-computed audit object the caller may pass instead of a url. Left as
    // any — it's the SiteAudit shape produced by our own auditSite/auditArticle.
    audit: z.any().optional(),
  })
  .refine((d) => d.audit || (typeof d.url === 'string' && isValidHttpUrl(d.url)), {
    message: 'A valid http(s) URL or audit data is required',
  })

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  const limited = await rateLimitGate(req, 'audit-fixbrief', 10)
  if (limited) return limited

  try {
    const parsed = fixBriefBodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 400 })
    }
    const { url, type, audit: providedAudit } = parsed.data

    const audit =
      providedAudit || (type === 'article' ? await auditArticle(url!) : await auditSite(url!))
    const brief = generateFixBrief(audit)
    const markdown = formatFixBriefAsMarkdown(brief)

    return NextResponse.json({ brief, markdown })
  } catch (err) {
    if (err instanceof SsrfError) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 })
    }
    logger.error('Fix brief API error', { err })
    return NextResponse.json({ error: 'Fix brief generation failed' }, { status: 500 })
  }
}
