// PATH: src/lib/services/crawler-access-audit.ts
//
// AI Crawler Access Audit — fetches `{brand_domain}/robots.txt`, parses
// it, and reports which AI crawlers can actually reach the site. If
// GPTBot is disallowed, NOTHING the rest of AEO Pulse measures about
// ChatGPT visibility is meaningful — the AI literally can't read the
// site. Foundational health check.
//
// Two halves:
//   1. parseRobotsTxt + checkBotAccess — pure functions over a robots.txt
//      string. Unit-testable, no I/O.
//   2. auditCrawlerAccess — combines fetch (via safeFetchText) with the
//      pure checker for the API route.
//
// The parser is intentionally minimal — robots.txt has plenty of weird
// real-world edge cases, but for the "is the bot blocked from the
// root path?" question we only need to look at Allow:/Disallow: paths
// per User-agent group. We DO honour the spec's precedence rule:
// the most-specific User-agent group wins; only fall back to `*` when
// no bot-specific group exists.

export interface AiBot {
  /** Lowercased user-agent token used in robots.txt matching. */
  id: string
  /** Human-readable label for the UI. */
  label: string
  /** Which AI engine the bot serves (or the closest analogue). */
  engine: 'chatgpt' | 'gemini' | 'perplexity' | 'claude' | 'training' | 'meta' | 'apple' | 'unknown'
  /** What blocking this bot actually costs the site.
   *  'search'   = AI search crawler: blocking it removes the site from that
   *               engine's index. The expensive mistake.
   *  'fetcher'  = on-demand fetcher: blocking it removes the site from live
   *               conversational answers only.
   *  'training' = model-training crawler: blocking it has no direct effect on
   *               search visibility, and for some sites it is deliberate.
   *  'hybrid'   = serves both classic search and AI search (Googlebot).
   *  'unknown'  = a token that is not in this catalog — the audit can still
   *               resolve robots.txt for it, but we do not claim to know what
   *               blocking it costs.
   *  This is the distinction operators get wrong most often: a site can be
   *  wide open to every search crawler and still show a red panel because it
   *  blocks training bots on purpose. Engine alone could not say that. */
  role: 'search' | 'fetcher' | 'training' | 'hybrid' | 'unknown'
  /** Source documentation URL — surfaces in the UI when an operator
   *  asks "what is this bot?". */
  docs: string
}

/** Curated list of the AI bots that matter for AEO Pulse coverage.
 *  Kept short and high-signal — adding every long-tail crawler floods
 *  the panel and operators stop reading.
 *
 *  Anthropic documents exactly three live tokens (verified 2026-08-19 on the
 *  support article linked below): ClaudeBot collects training data,
 *  Claude-User fetches a page on demand when someone asks Claude about it,
 *  and Claude-SearchBot indexes the web for Claude's search. Claude-Web and
 *  anthropic-ai are legacy tokens kept for sites whose robots.txt still names
 *  them. Claude is retired as a MONITORING engine here for cost reasons — the
 *  customer's visibility in Claude search is a fact of their market either
 *  way, so the audit still has to check it. */
export const AI_BOTS: AiBot[] = [
  {
    id: 'gptbot',
    label: 'GPTBot',
    engine: 'training',
    role: 'training',
    docs: 'https://platform.openai.com/docs/gptbot',
  },
  {
    id: 'chatgpt-user',
    label: 'ChatGPT-User',
    engine: 'chatgpt',
    role: 'fetcher',
    docs: 'https://platform.openai.com/docs/plugins/bot',
  },
  {
    id: 'oai-searchbot',
    label: 'OAI-SearchBot',
    engine: 'chatgpt',
    role: 'search',
    docs: 'https://platform.openai.com/docs/bots',
  },
  {
    id: 'perplexitybot',
    label: 'PerplexityBot',
    engine: 'perplexity',
    role: 'search',
    docs: 'https://docs.perplexity.ai/guides/bots',
  },
  {
    id: 'perplexity-user',
    label: 'Perplexity-User',
    engine: 'perplexity',
    role: 'fetcher',
    docs: 'https://docs.perplexity.ai/guides/bots',
  },
  {
    id: 'claudebot',
    label: 'ClaudeBot',
    engine: 'training',
    role: 'training',
    docs: 'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
  },
  {
    id: 'claude-searchbot',
    label: 'Claude-SearchBot',
    engine: 'claude',
    role: 'search',
    docs: 'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
  },
  {
    id: 'claude-user',
    label: 'Claude-User',
    engine: 'claude',
    role: 'fetcher',
    docs: 'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
  },
  {
    id: 'claude-web',
    label: 'Claude-Web',
    engine: 'claude',
    role: 'training',
    docs: 'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
  },
  {
    id: 'anthropic-ai',
    label: 'anthropic-ai',
    engine: 'claude',
    role: 'training',
    docs: 'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
  },
  {
    id: 'google-extended',
    label: 'Google-Extended',
    engine: 'gemini',
    role: 'training',
    docs: 'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers#google-extended',
  },
  {
    id: 'ccbot',
    label: 'CCBot (Common Crawl)',
    engine: 'training',
    role: 'training',
    docs: 'https://commoncrawl.org/ccbot',
  },
  {
    id: 'applebot-extended',
    label: 'Applebot-Extended',
    engine: 'apple',
    role: 'training',
    docs: 'https://support.apple.com/en-us/119829',
  },
  {
    id: 'meta-externalagent',
    label: 'Meta-ExternalAgent',
    engine: 'meta',
    role: 'training',
    docs: 'https://developers.facebook.com/docs/sharing/bot',
  },
  {
    id: 'bytespider',
    label: 'Bytespider (ByteDance)',
    engine: 'training',
    role: 'training',
    docs: 'https://www.bytedance.com',
  },
]

export type AccessVerdict =
  | 'allowed' // No root Disallow targeting this bot or `*`.
  | 'wildcard_blocked' // No bot-specific group; falls through to `*` with Disallow: /.
  | 'explicitly_blocked' // Bot-specific group exists with Disallow: /.
  | 'restricted' // Bot has its own group with subpath disallows but root open.
  | 'unknown' // robots.txt unreachable or unparseable.

export interface BotVerdict {
  bot: AiBot
  verdict: AccessVerdict
  /** Disallow paths that applied to this bot (after group resolution). */
  disallowPaths: string[]
  /** Allow paths for visibility — sometimes operators add Allow: / to
   *  explicitly override a wildcard block. */
  allowPaths: string[]
  /** Which User-agent group matched: 'specific' | 'wildcard' | 'none'. */
  matchedGroup: 'specific' | 'wildcard' | 'none'
}

interface ParsedGroup {
  uaTokens: Set<string> // lowercased
  allow: string[]
  disallow: string[]
}

export interface ParsedRobots {
  groups: ParsedGroup[]
  /** Sitemap URLs collected from the file (informational; surfaces in UI). */
  sitemaps: string[]
}

/** Minimal robots.txt parser. Splits into groups (each group is one or
 *  more User-agent lines followed by Allow:/Disallow: lines), ignores
 *  comments. Order of lines is preserved within a group; the spec lets
 *  multiple User-agent lines share the same body. */
export function parseRobotsTxt(content: string): ParsedRobots {
  const groups: ParsedGroup[] = []
  const sitemaps: string[] = []
  let current: ParsedGroup | null = null
  // True once we've started seeing Allow/Disallow lines — the NEXT
  // User-agent terminates the current group.
  let bodyStarted = false

  const lines = content.split(/\r?\n/)
  for (const rawLine of lines) {
    // Strip comments and trim whitespace.
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue

    const colon = line.indexOf(':')
    if (colon < 0) continue
    const directive = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()

    if (directive === 'sitemap') {
      if (value) sitemaps.push(value)
      continue
    }

    if (directive === 'user-agent') {
      const token = value.toLowerCase()
      if (!current || bodyStarted) {
        // Open a fresh group when we hit a User-agent after some body
        // lines (or at the very start).
        current = { uaTokens: new Set([token]), allow: [], disallow: [] }
        groups.push(current)
        bodyStarted = false
      } else {
        // Stacked User-agent line — same group, additional matcher.
        current.uaTokens.add(token)
      }
      continue
    }

    if (!current) {
      // Allow/Disallow before any User-agent — ignore per spec.
      continue
    }

    if (directive === 'allow') {
      // Empty Allow is a no-op per spec; skip to keep downstream length
      // counts honest ("does this group restrict anything?").
      if (value) current.allow.push(value)
      bodyStarted = true
    } else if (directive === 'disallow') {
      // Empty Disallow is the SPEC'S way of saying "nothing disallowed"
      // — equivalent to no Disallow line. Skip pushing so downstream
      // `length > 0` checks correctly read this as "no restriction".
      if (value) current.disallow.push(value)
      bodyStarted = true
    }
    // Crawl-delay / Host / others — ignored; not relevant to the
    // "can this bot reach the root?" question.
  }

  return { groups, sitemaps }
}

function isRootBlock(paths: string[]): boolean {
  // Disallow: / blocks everything; Disallow: (empty) means "nothing
  // disallowed", explicitly allowing crawl. Partial paths leave the root open
  // (verdict: restricted).
  //
  // `/*` is included because it is semantically identical to `/` — the
  // wildcard matches every path — and sites do write it. Matching only the
  // exact "/" reported all 13 bots as merely `restricted` against a file that
  // blocks every one of them, which lands on the customer-facing score as
  // 100/100 instead of 0/100. Every defect this module family has had failed
  // in that same optimistic direction, so it is worth naming the pattern.
  return paths.some((p) => p === '/' || p === '/*')
}

/**
 * Decide whether `botId` can crawl the site root, given a parsed
 * robots.txt. Honours the precedence rule: a bot-specific group ALWAYS
 * wins over `*`, even if the bot-specific group has nothing disallowed.
 *
 * Returns the verdict plus the paths that drove it (useful for UI:
 * "Disallow: /private was the only block, root is fine").
 */
export function checkBotAccess(parsed: ParsedRobots, botId: string): BotVerdict {
  const botToken = botId.toLowerCase()
  const bot = AI_BOTS.find((b) => b.id === botToken) ?? {
    id: botToken,
    label: botId,
    engine: 'unknown',
    role: 'unknown',
    docs: '',
  }

  // Find the bot-specific group (if any).
  const specific = parsed.groups.find((g) => g.uaTokens.has(botToken))
  if (specific) {
    if (isRootBlock(specific.disallow)) {
      return {
        bot,
        verdict: 'explicitly_blocked',
        disallowPaths: specific.disallow,
        allowPaths: specific.allow,
        matchedGroup: 'specific',
      }
    }
    // Bot-specific group exists but root not blocked. Possibly subpath
    // disallows (e.g. Disallow: /admin) — still callable for citation.
    const verdict: AccessVerdict = specific.disallow.length > 0 ? 'restricted' : 'allowed'
    return {
      bot,
      verdict,
      disallowPaths: specific.disallow,
      allowPaths: specific.allow,
      matchedGroup: 'specific',
    }
  }

  // No bot-specific group — fall through to wildcard `*`.
  const wildcard = parsed.groups.find((g) => g.uaTokens.has('*'))
  if (wildcard) {
    if (isRootBlock(wildcard.disallow)) {
      return {
        bot,
        verdict: 'wildcard_blocked',
        disallowPaths: wildcard.disallow,
        allowPaths: wildcard.allow,
        matchedGroup: 'wildcard',
      }
    }
    const verdict: AccessVerdict = wildcard.disallow.length > 0 ? 'restricted' : 'allowed'
    return {
      bot,
      verdict,
      disallowPaths: wildcard.disallow,
      allowPaths: wildcard.allow,
      matchedGroup: 'wildcard',
    }
  }

  // No group at all — default per spec is "allowed".
  return { bot, verdict: 'allowed', disallowPaths: [], allowPaths: [], matchedGroup: 'none' }
}

/**
 * Audit every bot in AI_BOTS against the parsed robots.txt and produce
 * the per-bot verdict list. Sorted: blocked first (highest urgency),
 * then restricted, then allowed.
 */
export function auditRobotsForAiBots(parsed: ParsedRobots): BotVerdict[] {
  const verdicts = AI_BOTS.map((b) => checkBotAccess(parsed, b.id))
  const rank: Record<AccessVerdict, number> = {
    explicitly_blocked: 0,
    wildcard_blocked: 1,
    restricted: 2,
    allowed: 3,
    unknown: 4,
  }
  verdicts.sort((a, b) => rank[a.verdict] - rank[b.verdict])
  return verdicts
}
