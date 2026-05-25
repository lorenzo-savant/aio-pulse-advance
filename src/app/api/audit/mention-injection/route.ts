// PATH: src/app/api/audit/mention-injection/route.ts
//
// POST /api/audit/mention-injection
//
// Finds owned pages that discuss brand-relevant topics but never mention
// the brand — "injection opportunities" per the Semrush "How We're
// Driving LLM Visibility" playbook (step 3: audit existing content for
// natural injection spots).
//
// Body:
//   {
//     brandId:  string,           // required
//     topics:   string[],         // required, at least 1 phrase
//     urls?:    string[],         // fetched server-side via safeFetch (cap 25)
//     pages?:   Array<{           // pre-fetched alternative
//       url:    string,
//       title?: string | null,
//       text?:  string,
//       html?:  string,
//     }>,
//     limit?:   number,           // default 50
//   }
//
// One of `urls` or `pages` must be supplied. Brand name + aliases + domain
// come from the authorized BrandAccess record so the caller can't probe
// arbitrary brands.

import { NextResponse, type NextRequest } from 'next/server'
import { requireUser, rateLimitGate, isValidHttpUrl } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { safeFetch, SsrfError } from '@/lib/utils/safe-fetch'
import { logger } from '@/lib/logger'
import {
  findMentionInjectionOpportunities,
  type InjectionPageInput,
} from '@/lib/utils/mention-injection'

export const dynamic = 'force-dynamic'

const MAX_URLS = 25
const FETCH_TIMEOUT_MS = 8_000
const MAX_TOPICS = 50

function err(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status })
}

function extractTitle(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  if (!m) return null
  return m[1]!.replace(/\s+/g, ' ').trim().slice(0, 200) || null
}

async function fetchPage(url: string): Promise<InjectionPageInput | null> {
  try {
    const response = await safeFetch(url, {
      timeout: FETCH_TIMEOUT_MS,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; AIO-Pulse-MentionAudit/1.0; +https://aiopulse.io/bot)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    if (!response.ok) return null
    const ct = response.headers.get('content-type') ?? ''
    if (!ct.includes('html') && !ct.includes('xml') && ct !== '') return null
    const html = await response.text()
    return { url, html, title: extractTitle(html) }
  } catch (e) {
    if (e instanceof SsrfError) {
      logger.warn('mention-injection: SSRF-blocked URL skipped', { url })
    } else {
      logger.warn('mention-injection: fetch failed', {
        url,
        err: e instanceof Error ? e.message : String(e),
      })
    }
    return null
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const limited = await rateLimitGate(req, 'audit-mention-injection', 10)
  if (limited) return limited

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body')
  }
  if (!body || typeof body !== 'object') return err('Invalid JSON body')

  const { brandId, topics, urls, pages, limit } = body as {
    brandId?: unknown
    topics?: unknown
    urls?: unknown
    pages?: unknown
    limit?: unknown
  }

  if (typeof brandId !== 'string' || !brandId) return err('brandId is required')

  const cleanedTopics =
    Array.isArray(topics) && topics.length > 0
      ? topics
          .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
          .map((t) => t.trim())
          .slice(0, MAX_TOPICS)
      : []
  if (cleanedTopics.length === 0) return err('topics must be a non-empty string array')

  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  const inputPages: InjectionPageInput[] = []

  // Pre-fetched pages: trust the caller's text/html, but require url.
  if (Array.isArray(pages)) {
    for (const p of pages) {
      if (!p || typeof p !== 'object') continue
      const pageUrl = (p as { url?: unknown }).url
      if (typeof pageUrl !== 'string' || !pageUrl) continue
      const text = (p as { text?: unknown }).text
      const html = (p as { html?: unknown }).html
      const title = (p as { title?: unknown }).title
      inputPages.push({
        url: pageUrl,
        title: typeof title === 'string' ? title : null,
        text: typeof text === 'string' ? text : undefined,
        html: typeof html === 'string' ? html : undefined,
      })
    }
  }

  // Server-side fetch: validate each URL and fetch in parallel (capped).
  if (Array.isArray(urls) && urls.length > 0) {
    const valid = urls
      .filter((u): u is string => typeof u === 'string' && isValidHttpUrl(u))
      .slice(0, MAX_URLS)
    const fetched = await Promise.all(valid.map((u) => fetchPage(u)))
    for (const p of fetched) {
      if (p) inputPages.push(p)
    }
  }

  if (inputPages.length === 0) {
    return err('Provide at least one of `urls` or `pages` with valid entries')
  }

  const cappedLimit = typeof limit === 'number' && limit > 0 ? Math.min(limit, 200) : 50

  const result = findMentionInjectionOpportunities({
    pages: inputPages,
    brand: {
      name: brand.name,
      aliases: brand.aliases ?? [],
      domain: brand.domain,
    },
    topics: cleanedTopics,
    limit: cappedLimit,
  })

  return NextResponse.json({
    success: true,
    data: result,
    timestamp: Date.now(),
  })
}
