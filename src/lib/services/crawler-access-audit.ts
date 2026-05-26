// PATH: src/lib/services/crawler-access-audit.ts
//
// AI Crawler Access Audit — fetches `{brand_domain}/robots.txt`, parses
// it, and reports which AI crawlers can actually reach the site. If
// GPTBot is disallowed, NOTHING the rest of AIO Pulse measures about
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
  /** Source documentation URL — surfaces in the UI when an operator
   *  asks "what is this bot?". */
  docs: string
}

/** Curated list of the AI bots that matter for AIO Pulse coverage.
 *  Kept short and high-signal — adding every long-tail crawler floods
 *  the panel and operators stop reading. */
export const AI_BOTS: AiBot[] = [
  {
    id: 'gptbot',
    label: 'GPTBot',
    engine: 'training',
    docs: 'https://platform.openai.com/docs/gptbot',
  },
  {
    id: 'chatgpt-user',
    label: 'ChatGPT-User',
    engine: 'chatgpt',
    docs: 'https://platform.openai.com/docs/plugins/bot',
  },
  {
    id: 'oai-searchbot',
    label: 'OAI-SearchBot',
    engine: 'chatgpt',
    docs: 'https://platform.openai.com/docs/bots',
  },
  {
    id: 'perplexitybot',
    label: 'PerplexityBot',
    engine: 'perplexity',
    docs: 'https://docs.perplexity.ai/guides/bots',
  },
  {
    id: 'perplexity-user',
    label: 'Perplexity-User',
    engine: 'perplexity',
    docs: 'https://docs.perplexity.ai/guides/bots',
  },
  {
    id: 'claudebot',
    label: 'ClaudeBot',
    engine: 'claude',
    docs: 'https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
  },
  {
    id: 'claude-web',
    label: 'Claude-Web',
    engine: 'claude',
    docs: 'https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
  },
  {
    id: 'anthropic-ai',
    label: 'anthropic-ai',
    engine: 'claude',
    docs: 'https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
  },
  {
    id: 'google-extended',
    label: 'Google-Extended',
    engine: 'gemini',
    docs: 'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers#google-extended',
  },
  {
    id: 'ccbot',
    label: 'CCBot (Common Crawl)',
    engine: 'training',
    docs: 'https://commoncrawl.org/ccbot',
  },
  {
    id: 'applebot-extended',
    label: 'Applebot-Extended',
    engine: 'apple',
    docs: 'https://support.apple.com/en-us/119829',
  },
  {
    id: 'meta-externalagent',
    label: 'Meta-ExternalAgent',
    engine: 'meta',
    docs: 'https://developers.facebook.com/docs/sharing/bot',
  },
  {
    id: 'bytespider',
    label: 'Bytespider (ByteDance)',
    engine: 'training',
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
  // disallowed", explicitly allowing crawl. We treat exact "/" as the
  // root block — partial paths leave the root open (verdict: restricted).
  return paths.some((p) => p === '/')
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
