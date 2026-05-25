// PATH: src/app/api/citations/cited-vs-ranking/route.ts
//
// GET /api/citations/cited-vs-ranking?brand_id=…&days=30
//
// Cross-references AI citations with Google rankings to highlight:
//   - SEO gaps: URLs AI cites often but Google ranks beyond top 10
//   - AEO gaps: URLs Google ranks top 10 but AI rarely cites
//   - aligned URLs the brand is winning on both layers
//
// Pure aggregation over monitoring_results + gsc_performance. No
// external API.

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import {
  crossReferenceCitedVsRanking,
  type CitedUrlInput,
  type GscPageInput,
} from '@/lib/utils/cited-vs-ranking'
import { logger } from '@/lib/logger'
import type { Brand } from '@/types'

export const dynamic = 'force-dynamic'

interface MonitoringRow {
  cited_urls: string[] | null
  engine: string | null
}

interface GscPageRow {
  dimension_value: string | null
  position: number | null
  clicks: number | null
  impressions: number | null
}

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

function hostOf(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`)
    return u.hostname.toLowerCase().replace(/^www\./, '') || null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const days = Math.min(365, Math.max(7, Number(searchParams.get('days')) || 30))

  if (!brandId) return err('brand_id is required', 400)

  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) return err('Brand not found or access denied', 404)
  const b = brand as Brand
  const ownedDomain = (b.domain ?? b.domains?.[0] ?? '').trim().toLowerCase()
  if (!ownedDomain) {
    return NextResponse.json({
      success: true,
      data: {
        report: null,
        reason: 'Brand has no owned domain — cross-reference analysis is unavailable.',
      },
      timestamp: Date.now(),
    })
  }
  const ownedHost = ownedDomain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]!

  const since = new Date()
  since.setDate(since.getDate() - days)

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const [{ data: monitoring, error: monErr }, { data: gscPages, error: gscErr }] =
      await Promise.all([
        (db as any)
          .from('monitoring_results')
          .select('cited_urls, engine')
          .eq('brand_id', brandId)
          .gte('created_at', since.toISOString())
          .limit(5000),
        (db as any)
          .from('gsc_performance')
          .select('dimension_value, position, clicks, impressions')
          .eq('brand_id', brandId)
          .eq('dimension_type', 'page')
          .limit(2000),
      ])
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // Monitoring is the primary signal — if it fails the whole report is
    // meaningless. GSC is auxiliary: when it's unavailable (table missing
    // for older deployments, brand has no GSC sync, RLS denial, etc.) we
    // still produce the citation side of the report and flag
    // gscAvailable=false so the UI can guide the user.
    if (monErr) {
      logger.error('/api/citations/cited-vs-ranking monitoring query failed', {
        err: String(monErr),
      })
      return err('Failed to load monitoring data')
    }
    if (gscErr) {
      logger.warn('/api/citations/cited-vs-ranking gsc query unavailable — degrading', {
        err: String(gscErr),
      })
    }
    const gscAvailable = !gscErr

    // Aggregate owned cited URLs (count + engines).
    const citedMap = new Map<string, CitedUrlInput>()
    for (const row of (monitoring ?? []) as MonitoringRow[]) {
      const urls = Array.isArray(row.cited_urls) ? row.cited_urls : []
      const eng = row.engine || 'unknown'
      for (const rawUrl of urls) {
        const host = hostOf(rawUrl)
        if (!host) continue
        if (host !== ownedHost && !host.endsWith(`.${ownedHost}`)) continue
        const existing = citedMap.get(rawUrl)
        if (existing) {
          existing.citationCount++
          const engines = new Set([...(existing.engines ?? []), eng])
          existing.engines = [...engines]
        } else {
          citedMap.set(rawUrl, { url: rawUrl, citationCount: 1, engines: [eng] })
        }
      }
    }

    const gscInputs: GscPageInput[] = ((gscPages ?? []) as GscPageRow[])
      .filter((p) => typeof p.dimension_value === 'string' && (p.position ?? 0) > 0)
      .map((p) => ({
        url: p.dimension_value as string,
        position: p.position as number,
        clicks: p.clicks ?? 0,
        impressions: p.impressions ?? 0,
      }))

    const report = crossReferenceCitedVsRanking([...citedMap.values()], gscInputs)

    return NextResponse.json({
      success: true,
      data: {
        ownedDomain: ownedHost,
        filters: { days },
        gscAvailable,
        report,
      },
      timestamp: Date.now(),
    })
  } catch (e) {
    logger.error('/api/citations/cited-vs-ranking failed', { err: String(e) })
    return err('Failed to cross-reference citations and rankings')
  }
}
