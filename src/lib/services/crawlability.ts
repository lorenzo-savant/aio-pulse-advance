// PATH: src/lib/services/crawlability.ts
//
// Public "can AI engines read your site?" check, served by
// /api/crawlability/check and /api/crawlability/bots. Both are unauthenticated,
// so this number is shown to people who are not customers yet.
//
// WHAT CHANGED, AND WHY
// This module used to carry its own robots.txt parser and its own bot list.
// Both were wrong, and both failed in the optimistic direction — telling a site
// owner every AI crawler could read them while the crawlers were blocked.
//
// The parser had three defects, all confirmed by executing it:
//
//   · User-agent lookup was an exact-case Map get, but RFC 9309 makes
//     user-agent matching case-insensitive. A robots.txt saying
//     `user-agent: gptbot` in lowercase scored 100/100 with an empty blocked
//     list, against a file that blocks GPTBot outright.
//   · Consecutive `User-agent:` lines sharing one rule block — a documented
//     and common pattern — silently dropped every agent but the last.
//   · Rule precedence sorted by wildcard count rather than path specificity,
//     so `Allow: /` beat `Disallow: /admin/`.
//
// The bot list was the worse half. It scored against `DuckBot`, which is not a
// real token (the crawler is `DuckDuckBot`), so that entry never matched
// anything and always counted as allowed. Seven of its thirteen entries were
// not AI answer-engine crawlers at all — Bingbot, Yandex, TwitterBot,
// FacebookBot, AdsBot-Google, Amazonbot, AdsBot — while the ones that decide
// whether ChatGPT, Perplexity and Claude can read a page were missing
// entirely: OAI-SearchBot, ChatGPT-User, Perplexity-User, Claude-Web,
// anthropic-ai, Meta-ExternalAgent, Bytespider.
//
// Fixing the parser without fixing the list would have left the customer-facing
// number just as wrong.
//
// Rather than repair either, this module now delegates to
// `crawler-access-audit`, which already parses correctly (lowercases tokens on
// both sides, keeps stacked User-agent lines in one group, resolves
// specific-beats-wildcard precedence) and already carries the curated AI bot
// registry. One parser, one list.

import { safeFetch } from '@/lib/utils/safe-fetch'
import {
  AI_BOTS,
  parseRobotsTxt,
  auditRobotsForAiBots,
  type AccessVerdict,
  type BotVerdict,
} from './crawler-access-audit'

export interface BotAccessResult {
  /** Human-readable bot label, e.g. "GPTBot". */
  bot: string
  allowed: boolean
  /** Why, in the caller's terms. Present whenever `allowed` is false. */
  reason?: string
}

export interface Recommendation {
  bot: string
  action: string
  priority: 'high' | 'medium' | 'low'
}

export interface CrawlabilityResult {
  url: string
  timestamp: string
  /** 0–100. Share of tracked AI crawlers that can reach the site. */
  score: number
  results: BotAccessResult[]
  recommendations: Recommendation[]
  /**
   * How the robots.txt itself was resolved. Surfaced because "no robots.txt"
   * and "robots.txt is down" produce very different scores and a caller
   * should be able to tell them apart.
   */
  robotsStatus: 'found' | 'absent' | 'unreachable'
}

/**
 * A bot counts as able to reach the site when its root is open.
 *
 * `restricted` counts as allowed on purpose: the bot has its own group with
 * subpath disallows but the root is open, so it can still fetch and cite the
 * pages that matter. Treating it as blocked would flag every site that hides
 * /admin.
 */
function isAllowed(verdict: AccessVerdict): boolean {
  return verdict === 'allowed' || verdict === 'restricted'
}

function reasonFor(v: BotVerdict): string | undefined {
  switch (v.verdict) {
    case 'explicitly_blocked':
      return `robots.txt has a ${v.bot.label} group with Disallow: /`
    case 'wildcard_blocked':
      return 'robots.txt blocks all crawlers with Disallow: / and has no group for this bot'
    case 'unknown':
      return 'robots.txt could not be read, so access cannot be confirmed'
    default:
      return undefined
  }
}

/**
 * Engines the product actually reports on outrank training-only and
 * social crawlers: being blocked to ChatGPT costs a customer visibility in a
 * surface they are paying to be measured in.
 */
function priorityFor(engine: string): 'high' | 'medium' | 'low' {
  if (engine === 'chatgpt' || engine === 'gemini' || engine === 'perplexity' || engine === 'claude')
    return 'high'
  if (engine === 'training') return 'medium'
  return 'low'
}

export function calculateCrawlabilityScore(results: BotAccessResult[]): number {
  if (results.length === 0) return 0
  const allowed = results.filter((r) => r.allowed).length
  return Math.round((allowed / results.length) * 100)
}

export function getRecommendations(verdicts: BotVerdict[]): Recommendation[] {
  return verdicts
    .filter((v) => !isAllowed(v.verdict))
    .map((v) => ({
      bot: v.bot.label,
      action:
        v.verdict === 'unknown'
          ? `Make robots.txt reachable so ${v.bot.label} access can be verified`
          : `Allow ${v.bot.label} in robots.txt`,
      priority: priorityFor(v.bot.engine),
    }))
}

/** Every tracked bot with the same verdict — used for the whole-file outcomes. */
function uniformVerdict(verdict: AccessVerdict): BotVerdict[] {
  return AI_BOTS.map((bot) => ({
    bot,
    verdict,
    disallowPaths: [],
    allowPaths: [],
    matchedGroup: 'none' as const,
  }))
}

export async function checkCrawlability(url: string): Promise<CrawlabilityResult> {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error('Invalid URL provided')
  }

  const robotsUrl = new URL('/robots.txt', parsedUrl.origin)

  let verdicts: BotVerdict[]
  let robotsStatus: CrawlabilityResult['robotsStatus']

  try {
    const response = await safeFetch(robotsUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      },
    })

    if (response.ok) {
      robotsStatus = 'found'
      verdicts = auditRobotsForAiBots(parseRobotsTxt(await response.text()))
    } else if (response.status >= 500) {
      // RFC 9309 §2.3.1.4: on an unavailable (5xx) robots.txt a crawler must
      // assume complete disallow. The previous implementation coerced ANY
      // non-ok response to an empty file and therefore scored 100 — the exact
      // inverse of the rule, and optimistic in the direction that costs the
      // customer visibility without telling them.
      robotsStatus = 'unreachable'
      verdicts = uniformVerdict('unknown')
    } else {
      // 404/410 and friends: no robots.txt is a valid state and means no
      // restrictions. This is the one case where scoring 100 is correct.
      robotsStatus = 'absent'
      verdicts = uniformVerdict('allowed')
    }
  } catch {
    // Network failure, DNS failure, or the SSRF guard refusing the target.
    // Unknown is not the same as allowed, and must not be reported as such.
    robotsStatus = 'unreachable'
    verdicts = uniformVerdict('unknown')
  }

  const results: BotAccessResult[] = verdicts.map((v) => {
    const reason = reasonFor(v)
    return {
      bot: v.bot.label,
      allowed: isAllowed(v.verdict),
      ...(reason ? { reason } : {}),
    }
  })

  return {
    url: parsedUrl.origin,
    timestamp: new Date().toISOString(),
    score: calculateCrawlabilityScore(results),
    results,
    recommendations: getRecommendations(verdicts),
    robotsStatus,
  }
}
