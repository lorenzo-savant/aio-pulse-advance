import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The public "can AI engines read your site?" check.
 *
 * The previous test file was DELETED rather than extended, because it encoded
 * the bugs. Every fixture in it wrote `User-agent: GPTBot` in exact case, and
 * `checkBotAccess(rules, 'GPTBot', …)` passed *because* the lookup was an
 * exact-case Map get. Any correct implementation turns those tests red, so
 * keeping them would have pressured the next person into re-encoding the
 * defect to get a green suite.
 *
 * These tests exercise the contract the two public API routes consume —
 * `checkCrawlability(url)` — rather than the parser internals, so the
 * implementation can be replaced again without rewriting them.
 *
 * The first three cases are the defects that shipped. Each one failed in the
 * optimistic direction: telling a site owner the AI crawlers could read them
 * while the crawlers were blocked.
 */

const { fetchImpl } = vi.hoisted(() => ({
  fetchImpl: { value: null as null | (() => Promise<Response>) },
}))

vi.mock('@/lib/utils/safe-fetch', () => ({
  safeFetch: async () => {
    if (!fetchImpl.value) throw new Error('no fetch configured')
    return fetchImpl.value()
  },
}))

const { checkCrawlability, calculateCrawlabilityScore } = await import('../services/crawlability')

/** Serve this robots.txt body with a 200. */
function serve(body: string) {
  fetchImpl.value = async () => new Response(body, { status: 200 })
}

/** Serve a bare status with no usable body. */
function serveStatus(status: number) {
  fetchImpl.value = async () => new Response('', { status })
}

const blocked = (r: { results: Array<{ bot: string; allowed: boolean }> }) =>
  r.results.filter((b) => !b.allowed).map((b) => b.bot)

beforeEach(() => {
  fetchImpl.value = null
})

describe('checkCrawlability — the three defects that shipped', () => {
  it('honours a lowercase user-agent (RFC 9309 makes matching case-insensitive)', async () => {
    // Shipped behaviour: score 100, empty blocked list, against a file that
    // blocks GPTBot outright.
    serve('user-agent: gptbot\ndisallow: /\n')

    const result = await checkCrawlability('https://example.com')

    expect(blocked(result)).toContain('GPTBot')
    expect(result.score).toBeLessThan(100)
  })

  it('keeps rules for every agent in a stacked User-agent group', async () => {
    // Shipped behaviour: only the LAST agent kept its rules; GPTBot came back
    // as allowed against a file that blocks it.
    serve('User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n')

    const result = await checkCrawlability('https://example.com')

    expect(blocked(result)).toContain('GPTBot')
    expect(blocked(result)).toContain('ClaudeBot')
  })

  it('treats an unreachable robots.txt as disallow, not as an empty file', async () => {
    // Shipped behaviour: any non-ok response was coerced to an empty string
    // and scored 100. RFC 9309 §2.3.1.4 says a 5xx means assume complete
    // disallow — the exact inverse.
    serveStatus(503)

    const result = await checkCrawlability('https://example.com')

    expect(result.robotsStatus).toBe('unreachable')
    expect(result.score).toBe(0)
    expect(result.recommendations.every((r) => /reachable/i.test(r.action))).toBe(true)
  })
})

describe('checkCrawlability — states that were already correct', () => {
  it('scores 100 when there is no robots.txt at all', async () => {
    // A missing robots.txt genuinely means no restrictions. This is the one
    // case where a perfect score is the right answer.
    serveStatus(404)

    const result = await checkCrawlability('https://example.com')

    expect(result.robotsStatus).toBe('absent')
    expect(result.score).toBe(100)
    expect(result.recommendations).toEqual([])
  })

  it('scores 0 when everything is blocked by the wildcard group', async () => {
    serve('User-agent: *\nDisallow: /\n')

    const result = await checkCrawlability('https://example.com')

    expect(result.score).toBe(0)
    expect(result.results.every((r) => !r.allowed)).toBe(true)
  })

  it('scores 100 when the wildcard group only hides a subpath', async () => {
    // Root open, /admin hidden. Every bot can still fetch and cite the pages
    // that matter, so flagging this would fire on most of the web.
    serve('User-agent: *\nDisallow: /admin/\n')

    const result = await checkCrawlability('https://example.com')

    expect(result.score).toBe(100)
  })

  it('reports unreachable rather than allowed when the fetch throws', async () => {
    // Network failure, DNS failure, or the SSRF guard refusing the target.
    // Unknown is not the same as allowed.
    fetchImpl.value = async () => {
      throw new Error('ENOTFOUND')
    }

    const result = await checkCrawlability('https://example.com')

    expect(result.robotsStatus).toBe('unreachable')
    expect(result.score).toBe(0)
  })

  it('rejects a malformed URL before making any request', async () => {
    await expect(checkCrawlability('not a url')).rejects.toThrow('Invalid URL provided')
  })
})

describe('the tracked bot list', () => {
  it('covers the crawlers that decide AI answer-engine visibility', async () => {
    serveStatus(404)
    const names = (await checkCrawlability('https://example.com')).results.map((r) => r.bot)

    // These were missing entirely from the list this module used to carry.
    for (const bot of [
      'GPTBot',
      'ChatGPT-User',
      'OAI-SearchBot',
      'PerplexityBot',
      'Perplexity-User',
      'ClaudeBot',
      'Claude-Web',
      'anthropic-ai',
      'Google-Extended',
    ]) {
      expect(names).toContain(bot)
    }
  })

  it('no longer scores against crawlers that are not AI answer engines', async () => {
    serveStatus(404)
    const names = (await checkCrawlability('https://example.com')).results.map((r) => r.bot)

    // Seven of the old thirteen entries were search, ads or social crawlers.
    for (const bot of ['Bingbot', 'Yandex', 'TwitterBot', 'FacebookBot', 'AdsBot-Google']) {
      expect(names).not.toContain(bot)
    }
  })

  it('no longer scores against DuckBot, which is not a real user-agent token', async () => {
    // The real crawler is `DuckDuckBot`. The old entry never matched anything
    // in any robots.txt, so it counted as allowed every single time and
    // inflated the score by a fixed amount.
    serveStatus(404)
    const names = (await checkCrawlability('https://example.com')).results.map((r) => r.bot)

    expect(names).not.toContain('DuckBot')
  })
})

describe('recommendations', () => {
  it('ranks the four reported engines above training-only crawlers', async () => {
    serve('User-agent: *\nDisallow: /\n')

    const result = await checkCrawlability('https://example.com')
    const byBot = new Map(result.recommendations.map((r) => [r.bot, r.priority]))

    expect(byBot.get('ClaudeBot')).toBe('high')
    expect(byBot.get('PerplexityBot')).toBe('high')
    expect(byBot.get('CCBot (Common Crawl)')).toBe('medium')
  })

  it('says nothing when every tracked bot can read the site', async () => {
    serve('User-agent: *\nAllow: /\n')

    const result = await checkCrawlability('https://example.com')

    expect(result.recommendations).toEqual([])
  })
})

describe('calculateCrawlabilityScore', () => {
  it('is the share of bots that can reach the site', () => {
    expect(
      calculateCrawlabilityScore([
        { bot: 'a', allowed: true },
        { bot: 'b', allowed: true },
        { bot: 'c', allowed: false },
        { bot: 'd', allowed: false },
      ]),
    ).toBe(50)
  })

  it('returns 0 rather than dividing by zero on an empty list', () => {
    expect(calculateCrawlabilityScore([])).toBe(0)
  })
})
