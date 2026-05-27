// PATH: src/app/api/first-party-citations/route.ts
//
// Lists pages on the brand's OWN domain that AI engines are actually
// citing, ranked by hit count and with per-engine breakdown. Direct
// answer to "which pages on my site does AI cite most?" from the
// industry research "Why AI is citing third-party sources" piece. Pure DB
// query — reads cited_urls already stored on monitoring_results.

import { type NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

function hostOf(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname
      .toLowerCase()
      .replace(/^www\./, '')
  } catch {
    return ''
  }
}

function pathKey(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    // Strip query + fragment so /pricing?ref=x and /pricing collapse.
    const path = u.pathname.replace(/\/+$/, '') || '/'
    return `${u.hostname.replace(/^www\./, '')}${path}`
  } catch {
    return url
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const brandId = req.nextUrl.searchParams.get('brand_id')
  const days = Math.min(720, Math.max(7, Number(req.nextUrl.searchParams.get('days')) || 180))
  if (!brandId) return err('brand_id is required', 400)
  if (!(await verifyBrandAccess(brandId, userId))) return err('Forbidden', 403)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data: brandRow } = await (db as any)
    .from('brands')
    .select('domain, domains')
    .eq('id', brandId)
    .single()
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const ownDomains: string[] = [
    ...((brandRow?.domain as string | null) ? [brandRow.domain as string] : []),
    ...(Array.isArray(brandRow?.domains) ? (brandRow.domains as string[]) : []),
  ]
    .map((d) =>
      d
        .replace(/^https?:\/\//i, '')
        .replace(/\/.*$/, '')
        .toLowerCase(),
    )
    .filter(Boolean)

  if (ownDomains.length === 0) {
    return NextResponse.json({
      success: true,
      data: {
        pages: [],
        totalFirstParty: 0,
        totalCitations: 0,
        ownDomains: [],
        message: 'No brand domain configured — add one to see first-party citations.',
      },
      timestamp: Date.now(),
    })
  }

  const since = new Date()
  since.setDate(since.getDate() - days)

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data, error } = await (db as any)
    .from('monitoring_results')
    .select('engine, cited_urls')
    .eq('brand_id', brandId)
    .gte('created_at', since.toISOString())
    .not('cited_urls', 'is', null)
    .limit(5000)
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (error) {
    logger.error('/api/first-party-citations failed', { err: String(error) })
    return err('Failed to load citation data')
  }

  type PageStat = {
    url: string
    hits: number
    engines: Record<string, number>
  }
  const pageMap = new Map<string, PageStat>()
  let totalCitations = 0
  let totalFirstParty = 0

  for (const row of (data ?? []) as Array<{ engine: string; cited_urls: string[] | null }>) {
    for (const u of row.cited_urls ?? []) {
      totalCitations++
      const host = hostOf(u)
      if (!host) continue
      const isOwn = ownDomains.some((d) => host === d || host.endsWith(`.${d}`))
      if (!isOwn) continue
      totalFirstParty++
      const key = pathKey(u)
      let cur = pageMap.get(key)
      if (!cur) {
        cur = { url: key, hits: 0, engines: {} }
        pageMap.set(key, cur)
      }
      cur.hits++
      cur.engines[row.engine] = (cur.engines[row.engine] ?? 0) + 1
    }
  }

  const pages = Array.from(pageMap.values())
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 100)

  return NextResponse.json({
    success: true,
    data: {
      pages,
      totalFirstParty,
      totalCitations,
      ownDomains,
      filters: { days },
    },
    timestamp: Date.now(),
  })
}
