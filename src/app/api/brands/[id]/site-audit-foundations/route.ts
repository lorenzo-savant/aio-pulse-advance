// PATH: src/app/api/brands/[id]/site-audit-foundations/route.ts
//
// GET → foundational presence checks for the Site Audit Hub: HTTPS root,
// /llms.txt, /llms-full.txt, /sitemap.xml. Aggregated 0-100 score +
// next-action recommendations. Heavier audits (crawler access, citation
// capture, content quality) live in their own routes — this one is the
// "is the basic plumbing in place" check.

import { type NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { auditFoundations } from '@/lib/services/site-audit-presence'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params

  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const brand = await verifyBrandAccess(id, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  const ip = getClientIp(req.headers)
  // 6/min — same budget as the robots.txt audit. Each call hits the
  // brand domain four times in parallel; over-running burns goodwill.
  const rate = await checkRateLimit(`site-audit-foundations:${ip}`, 6, 60_000)
  if (!rate.success) return err('Rate limit exceeded', 429)

  const brandDomain = (brand as { domain?: string | null }).domain
  if (!brandDomain) {
    return err('Brand has no domain set — configure it on the brand edit page first.', 400)
  }

  try {
    const report = await auditFoundations(brandDomain)
    return NextResponse.json({ success: true, data: report, timestamp: Date.now() })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn('/api/site-audit-foundations failed', { brandId: id, err: message })
    return err(message)
  }
}
