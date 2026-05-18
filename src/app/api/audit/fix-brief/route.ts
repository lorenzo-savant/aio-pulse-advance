import { NextRequest, NextResponse } from 'next/server'
import { generateFixBrief, formatFixBriefAsMarkdown } from '@/lib/audit/fix-brief'
import { auditSite, auditArticle } from '@/lib/audit/site-audit'
import { requireUser, rateLimitGate, isValidHttpUrl } from '@/lib/api-auth'
import { SsrfError } from '@/lib/utils/safe-fetch'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  const limited = await rateLimitGate(req, 'audit-fixbrief', 10)
  if (limited) return limited

  try {
    const body = await req.json()
    const { url, type = 'site', audit: providedAudit } = body

    if (!providedAudit && !isValidHttpUrl(url)) {
      return NextResponse.json(
        { error: 'A valid http(s) URL or audit data is required' },
        { status: 400 },
      )
    }

    const audit =
      providedAudit || (type === 'article' ? await auditArticle(url) : await auditSite(url))
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
