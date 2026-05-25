// PATH: src/app/api/audience-audit/route.ts
//
// Audits the brand's homepage for explicit audience-declaration signals
// (industry pages, persona pages, use-case pages, "built for X"
// language). Output backs the AudienceDeclarationPanel that surfaces the
// agentic-web readiness gap from the Semrush "agentic web" piece.

import { type NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { runAudienceAudit } from '@/lib/services/audience-declaration'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const brandId = req.nextUrl.searchParams.get('brand_id')
  const explicitDomain = req.nextUrl.searchParams.get('domain')
  if (!brandId) return err('brand_id is required', 400)
  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) return err('Forbidden', 403)

  // Allow the operator to audit any of the brand's declared domains
  // explicitly; otherwise fall back to the first one we know.
  const candidates: string[] = []
  if (explicitDomain) candidates.push(explicitDomain)
  if (brand.domain) candidates.push(brand.domain)
  // BrandAccess intentionally narrows to the legacy single-domain field
  // for the type, but the row often carries a `domains` text[]. Pull
  // it with a structural cast so the audit can hit alternates.
  const extra = (brand as unknown as { domains?: string[] | null }).domains
  if (Array.isArray(extra)) candidates.push(...extra)

  const domain = candidates.find((d) => typeof d === 'string' && d.trim().length > 0)
  if (!domain) {
    return NextResponse.json({
      success: true,
      data: {
        domain: null,
        result: null,
        message: 'No domain configured on the brand — set one to run the audit.',
      },
      timestamp: Date.now(),
    })
  }

  try {
    const result = await runAudienceAudit(domain)
    return NextResponse.json({
      success: true,
      data: { domain, result },
      timestamp: Date.now(),
    })
  } catch (e) {
    logger.error('/api/audience-audit failed', { err: String(e) })
    return err('Failed to run audience audit')
  }
}
