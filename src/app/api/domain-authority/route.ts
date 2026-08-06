// PATH: src/app/api/domain-authority/route.ts
//
// POST /api/domain-authority  body: { brand_id }
// → { success, score, category, detail }
//
// Derives a 0-100 "AI domain authority" score for the brand's own domain
// entirely from data the app already has — there is no paid DA/DR API wired
// up, so the previous implementation POSTed here and 404'd, leaving the
// dashboard stuck on "-". The score blends:
//   1) the registrable-domain's public category (institutional/press/etc.
//      from ai-trust-score), and
//   2) how strongly the AI engines actually cite the brand today — citation
//      rate and engine coverage from monitoring_results.
// Both signals are computed live, so the number reflects reality rather than
// a cached third-party index.

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { classifyDomainAuthority, type DomainCategory } from '@/lib/utils/ai-trust-score'
import { logger } from '@/lib/logger'
import type { Brand } from '@/types'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  brand_id: z.string().uuid(),
})

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// The public-category base is a small share of the total; the citation
// behaviour of the engines dominates (that is what AVI measures).
const CATEGORY_BASE: Record<DomainCategory, number> = {
  institutional: 35,
  wiki: 30,
  official_press: 30,
  community: 20,
  social: 15,
  aggregator: 15,
  commercial: 10,
  unknown: 5,
}

function hostOf(raw: string): string | null {
  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`)
    return u.hostname.toLowerCase().replace(/^www\./, '') || null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return err('brand_id is required', 400)

  const brandId = parsed.data.brand_id

  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  const b = brand as Brand
  const ownedDomain = (b.domain ?? b.domains?.[0] ?? '').trim().toLowerCase()
  if (!ownedDomain) {
    return NextResponse.json({
      success: true,
      score: null,
      category: 'unknown',
      detail: { reason: 'Brand has no domain set' },
      timestamp: Date.now(),
    })
  }

  const ownedHost = hostOf(ownedDomain)
  if (!ownedHost) {
    return NextResponse.json({
      success: true,
      score: null,
      category: 'unknown',
      detail: { reason: 'Brand domain is not parseable' },
      timestamp: Date.now(),
    })
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  try {
    // Window: last 30 days of monitoring results for the brand.
    const since = new Date()
    since.setDate(since.getDate() - 30)

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const { data, error } = await (db as any)
      .from('monitoring_results')
      .select('engine, cited_urls, brand_mentioned')
      .eq('brand_id', brandId)
      .gte('created_at', since.toISOString())
      .limit(1000)
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (error) {
      logger.error('/api/domain-authority query failed', { err: error })
      return err('Failed to load monitoring data')
    }

    const rows = (data ?? []) as Array<{
      engine: string | null
      cited_urls: string[] | null
      brand_mentioned: boolean | null
    }>

    // Citation rate: share of responses (rows) that cite the brand's own
    // domain — measures first-party visibility. Mention rate adds responses
    // that mention the brand without citing a page on its domain.
    let citingOwn = 0
    let mentioning = 0
    const enginesCited = new Set<string>()
    for (const row of rows) {
      const citedOwn =
        Array.isArray(row.cited_urls) &&
        row.cited_urls.some((u) => {
          const h = hostOf(u)
          return h === ownedHost || h?.endsWith(`.${ownedHost}`)
        })
      if (citedOwn) {
        citingOwn++
        if (row.engine) enginesCited.add(row.engine)
      }
      if (row.brand_mentioned) mentioning++
    }

    const total = Math.max(1, rows.length)
    const citationRate = citingOwn / total
    const mentionRate = mentioning / total

    // Engine coverage: share of active engines that have cited the brand.
    // Heuristic weight — engine coverage is the strongest AI-visibility signal.
    const engineCoverage = enginesCited.size / 4 // chatgpt, gemini, perplexity, claude

    const category = classifyDomainAuthority(ownedHost)
    const categoryPoints = CATEGORY_BASE[category]

    // Blend: category base (≤35) + citation behaviour (≤65).
    const behaviourPoints = Math.min(
      65,
      Math.round(citationRate * 45 + mentionRate * 10 + engineCoverage * 10),
    )
    const score = Math.max(0, Math.min(100, categoryPoints + behaviourPoints))

    return NextResponse.json({
      success: true,
      score,
      category,
      detail: {
        ownedHost,
        categoryPoints,
        citationRate: Number(citationRate.toFixed(3)),
        mentionRate: Number(mentionRate.toFixed(3)),
        engineCoverage: Number(engineCoverage.toFixed(3)),
        resultsInWindow: rows.length,
      },
      timestamp: Date.now(),
    })
  } catch (e) {
    logger.error('/api/domain-authority failed', { err: e })
    return err('Failed to compute domain authority')
  }
}
