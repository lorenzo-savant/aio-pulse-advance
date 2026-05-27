// PATH: src/app/api/citation-quality/route.ts
//
// POST → score the citation-quality of pasted text or a fetched URL
// against the five AI-citation signals (see scoreCitationQuality
// in src/lib/services/citation-quality-scorer.ts).
//
// Text mode: pure, no network. URL mode: fetches HTML with safeFetchText
// so SSRF protection + timeout already applies. Scorer is pure.

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/api-auth'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { safeFetchText } from '@/lib/utils/safe-fetch'
import { scoreCitationQuality } from '@/lib/services/citation-quality-scorer'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  input: z.string().min(5).max(50_000),
  mode: z.enum(['text', 'url']).optional().default('text'),
})

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

/** Strip HTML to plain text without losing line breaks (so the markdown-
 *  heading + list heuristics in the scorer still fire on extracted text). */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(?:h[1-6]|p|div|li|ul|ol|section|article|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 20_000)
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  const ip = getClientIp(req.headers)
  // URL mode hits the network; throttle a bit tighter than text mode.
  const rate = await checkRateLimit(`citation-quality:${ip}`, 12, 60_000)
  if (!rate.success) return err('Rate limit exceeded', 429)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    )
  }

  const { input, mode } = parsed.data

  if (mode === 'text') {
    // No HTML available; structured-data pillar will return 0 with a hint.
    const report = scoreCitationQuality({ text: input })
    return NextResponse.json({ success: true, data: report, mode, timestamp: Date.now() })
  }

  // URL mode — fetch the page HTML through the project's SSRF-safe helper.
  const normalized = /^https?:\/\//i.test(input) ? input : `https://${input}`
  try {
    const { text: html, response } = await safeFetchText(normalized, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AIOPulseBot/1.0; +https://aio-pulse.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
      timeout: 30_000,
    })
    if (!response.ok) {
      return err(`Failed to fetch URL: HTTP ${response.status}`, 502)
    }
    const text = htmlToText(html)
    if (text.length < 50) {
      return err('Page content too short or unreadable', 422)
    }
    const report = scoreCitationQuality({ text, html })
    return NextResponse.json({
      success: true,
      data: report,
      mode,
      fetchedUrl: normalized,
      timestamp: Date.now(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.warn('/api/citation-quality URL fetch failed', { url: normalized, err: msg })
    return err(`Could not fetch URL: ${msg}`, 502)
  }
}
