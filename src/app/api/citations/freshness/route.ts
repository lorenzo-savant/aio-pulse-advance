// PATH: src/app/api/citations/freshness/route.ts
//
// GET /api/citations/freshness?brand_id=…&days=30&top=20
//
// "Which of MY pages does the AI cite, and are they fresh?"
//
// Pipeline:
//   1) Pull monitoring_results.cited_urls for the brand+window, filter
//      to URLs on the brand's owned domain, aggregate citation counts
//      per normalized URL (path-stable, query/fragment stripped).
//   2) Pick the top N (default 20) by citation count and HEAD-then-GET
//      each one with safeFetch (SSRF-hardened; only HTML/plaintext
//      content types). Parse last-modified out of the body via the
//      same signals the technical-seo-audit uses.
//   3) Feed the (url, citationCount, lastModifiedMs) tuples into
//      analyseFreshness — which buckets pages by age, computes the
//      Pearson correlation between age and citation count, and
//      surfaces the "stale stars" (high-citation + age > 365d).
//
// No new external API. Uses safeFetch + existing GSC/Brave/etc. nothing.
// Cap on N keeps the cost bounded (1 HTTP fetch per cited owned page).

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import {
  analyseFreshness,
  extractLastModifiedFromHtml,
  type FreshnessInput,
} from '@/lib/utils/citation-freshness'
import { safeFetch } from '@/lib/utils/safe-fetch'
import { logger } from '@/lib/logger'
import type { Brand } from '@/types'

export const dynamic = 'force-dynamic'

interface ResultRow {
  cited_urls: string[] | null
  engine: string | null
  created_at: string
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

/** Normalise a URL for aggregation: strip query and fragment, lowercase host,
 *  drop trailing slash. Preserves the meaningful path so /blog/x and
 *  /blog/x/ collapse together but /blog/x and /blog/y stay distinct. */
function normaliseUrl(raw: string): string | null {
  try {
    const u = new URL(raw)
    const path = u.pathname.replace(/\/+$/, '') || '/'
    return `${u.protocol}//${u.host.toLowerCase()}${path}`
  } catch {
    return null
  }
}

async function fetchLastModified(url: string): Promise<number | null> {
  try {
    const res = await safeFetch(url, {
      timeout: 8000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; aio-pulse-freshness/1.0; +https://aio-pulse.com/bot)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('text/html') && !ct.includes('xml') && !ct.includes('text/plain')) {
      return null
    }
    // Also accept the Last-Modified response header as a fallback signal.
    const lastModHeader = res.headers.get('last-modified')
    const headerTs = lastModHeader ? Date.parse(lastModHeader) : NaN
    const html = await res.text().catch(() => '')
    const bodyTs = extractLastModifiedFromHtml(html)
    const candidates: number[] = []
    if (Number.isFinite(headerTs)) candidates.push(headerTs)
    if (bodyTs != null) candidates.push(bodyTs)
    if (candidates.length === 0) return null
    return Math.max(...candidates)
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
  const topN = Math.min(50, Math.max(5, Number(searchParams.get('top')) || 20))

  if (!brandId) return err('brand_id is required', 400)

  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  const b = brand as Brand
  // The brand's "owned" domain — prefer brand.domain, fall back to
  // brand.domains[0]. If neither is set, we can't filter to "your pages",
  // so we early-return an empty report.
  const ownedDomain = (b.domain ?? b.domains?.[0] ?? '').trim().toLowerCase()
  if (!ownedDomain) {
    return NextResponse.json({
      success: true,
      data: {
        summary: { totalPages: 0, totalCitations: 0, pagesWithAge: 0, ageCoverage: 0 },
        report: null,
        reason: 'Brand has no owned domain — set brand.domain to enable freshness analysis.',
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
    const { data, error } = await (db as any)
      .from('monitoring_results')
      .select('cited_urls, engine, created_at')
      .eq('brand_id', brandId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(5000)
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (error) {
      logger.error('/api/citations/freshness query failed', { err: error })
      return err('Failed to load citation data')
    }

    const rows = (data || []) as ResultRow[]

    interface Agg {
      url: string
      citationCount: number
      engines: Set<string>
    }
    const byUrl = new Map<string, Agg>()
    for (const row of rows) {
      const urls = Array.isArray(row.cited_urls) ? row.cited_urls : []
      const eng = row.engine || 'unknown'
      for (const rawUrl of urls) {
        const host = hostOf(rawUrl)
        if (!host) continue
        if (host !== ownedHost && !host.endsWith(`.${ownedHost}`)) continue
        const normalized = normaliseUrl(rawUrl)
        if (!normalized) continue
        let agg = byUrl.get(normalized)
        if (!agg) {
          agg = { url: normalized, citationCount: 0, engines: new Set() }
          byUrl.set(normalized, agg)
        }
        agg.citationCount++
        agg.engines.add(eng)
      }
    }

    // Top N cited owned URLs — these are the only ones we fetch.
    const topUrls = [...byUrl.values()]
      .sort((a, b) => b.citationCount - a.citationCount)
      .slice(0, topN)

    // Fetch in parallel — each capped at 8s by safeFetch, no fan-out concern.
    const lastModifieds = await Promise.all(topUrls.map((u) => fetchLastModified(u.url)))

    const inputs: FreshnessInput[] = topUrls.map((u, i) => ({
      url: u.url,
      citationCount: u.citationCount,
      lastModifiedMs: lastModifieds[i] ?? null,
      engines: [...u.engines].sort(),
    }))

    const report = analyseFreshness(inputs)

    return NextResponse.json({
      success: true,
      data: {
        ownedDomain: ownedHost,
        filters: { days, top: topN },
        report,
      },
      timestamp: Date.now(),
    })
  } catch (e) {
    logger.error('/api/citations/freshness failed', { err: e })
    return err('Failed to analyse citation freshness')
  }
}
