// PATH: src/app/api/brands/[id]/crawler-audit/route.ts
//
// GET → fetch `{brand_domain}/robots.txt`, parse it, return per-bot
// access verdicts for the AI crawlers AEO Pulse cares about (GPTBot,
// PerplexityBot, ClaudeBot, Google-Extended, etc.). If any of these
// are blocked, the brand's AI visibility is structurally capped.

import { type NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { safeFetchText } from '@/lib/utils/safe-fetch'
import {
  AI_BOTS,
  auditRobotsForAiBots,
  parseRobotsTxt,
  type BotVerdict,
} from '@/lib/services/crawler-access-audit'
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
  // Tighter limit — fetches the brand's site, so we want operators to
  // run this occasionally, not on every dashboard mount.
  const rate = await checkRateLimit(`crawler-audit:${ip}`, 6, 60_000)
  if (!rate.success) return err('Rate limit exceeded', 429)

  const brandDomain = (brand as { domain?: string | null }).domain
  if (!brandDomain) {
    return err('Brand has no domain set — configure it on the brand edit page first.', 400)
  }

  // Normalise: strip protocol/path, keep registrable host.
  const cleanDomain = brandDomain
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .trim()
  if (!cleanDomain) {
    return err('Brand domain is not a valid host.', 400)
  }

  const robotsUrl = `https://${cleanDomain}/robots.txt`
  try {
    const { text: content, response } = await safeFetchText(robotsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AIOPulseBot/1.0; +https://aio-pulse.app)',
        Accept: 'text/plain, */*',
      },
      timeout: 20_000,
    })

    if (!response.ok) {
      // 404 robots.txt = "no rules", which per spec means everything is
      // allowed. We surface this as a positive signal, not an error.
      if (response.status === 404) {
        const allowedAll: BotVerdict[] = AI_BOTS.map((bot) => ({
          bot,
          verdict: 'allowed',
          disallowPaths: [],
          allowPaths: [],
          matchedGroup: 'none',
        }))
        return NextResponse.json({
          success: true,
          data: {
            domain: cleanDomain,
            robotsUrl,
            robotsExists: false,
            statusCode: 404,
            content: null,
            sitemaps: [],
            verdicts: allowedAll,
            summary: summarise(allowedAll),
            note: 'No robots.txt found — by spec, all crawlers are allowed.',
          },
          timestamp: Date.now(),
        })
      }
      return err(`robots.txt fetch returned HTTP ${response.status}`, 502)
    }

    const parsed = parseRobotsTxt(content)
    const verdicts = auditRobotsForAiBots(parsed)

    return NextResponse.json({
      success: true,
      data: {
        domain: cleanDomain,
        robotsUrl,
        robotsExists: true,
        statusCode: response.status,
        // Cap raw content so we don't ship huge files back to the panel.
        content: content.slice(0, 4000),
        contentTruncated: content.length > 4000,
        sitemaps: parsed.sitemaps,
        verdicts,
        summary: summarise(verdicts),
      },
      timestamp: Date.now(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.warn('/api/crawler-audit fetch failed', { url: robotsUrl, err: msg })
    return err(`Could not fetch robots.txt: ${msg}`, 502)
  }
}

interface AuditSummary {
  totalBots: number
  blocked: number
  restricted: number
  allowed: number
  /** Highest-priority engines blocked (for the headline message). */
  blockedEngines: string[]
}

function summarise(verdicts: BotVerdict[]): AuditSummary {
  let blocked = 0
  let restricted = 0
  let allowed = 0
  const blockedEngines = new Set<string>()
  for (const v of verdicts) {
    if (v.verdict === 'explicitly_blocked' || v.verdict === 'wildcard_blocked') {
      blocked++
      if (v.bot.engine !== 'unknown') blockedEngines.add(v.bot.engine)
    } else if (v.verdict === 'restricted') {
      restricted++
    } else if (v.verdict === 'allowed') {
      allowed++
    }
  }
  return {
    totalBots: verdicts.length,
    blocked,
    restricted,
    allowed,
    blockedEngines: Array.from(blockedEngines),
  }
}
