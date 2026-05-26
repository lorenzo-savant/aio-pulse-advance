import { describe, it, expect } from 'vitest'
import {
  AI_BOTS,
  auditRobotsForAiBots,
  checkBotAccess,
  parseRobotsTxt,
} from '../services/crawler-access-audit'

describe('parseRobotsTxt', () => {
  it('parses a single User-agent group with disallow paths', () => {
    const r = parseRobotsTxt(`User-agent: GPTBot
Disallow: /
`)
    expect(r.groups).toHaveLength(1)
    expect(r.groups[0]?.uaTokens.has('gptbot')).toBe(true)
    expect(r.groups[0]?.disallow).toEqual(['/'])
  })

  it('handles multiple groups separated by User-agent lines', () => {
    const r = parseRobotsTxt(`User-agent: GPTBot
Disallow: /

User-agent: *
Disallow: /admin
`)
    expect(r.groups).toHaveLength(2)
    expect(r.groups[0]?.uaTokens.has('gptbot')).toBe(true)
    expect(r.groups[1]?.uaTokens.has('*')).toBe(true)
  })

  it('stacks consecutive User-agent lines into one group', () => {
    const r = parseRobotsTxt(`User-agent: GPTBot
User-agent: PerplexityBot
Disallow: /
`)
    expect(r.groups).toHaveLength(1)
    expect(r.groups[0]?.uaTokens.has('gptbot')).toBe(true)
    expect(r.groups[0]?.uaTokens.has('perplexitybot')).toBe(true)
  })

  it('ignores comments and blank lines', () => {
    const r = parseRobotsTxt(`# This is the robots.txt
User-agent: GPTBot  # block training crawler
Disallow: /  # everything

# end of file
`)
    expect(r.groups[0]?.disallow).toEqual(['/'])
  })

  it('collects Sitemap declarations', () => {
    const r = parseRobotsTxt(`Sitemap: https://acasting.se/sitemap.xml
User-agent: *
Disallow:
`)
    expect(r.sitemaps).toEqual(['https://acasting.se/sitemap.xml'])
  })

  it('lowercases User-agent tokens', () => {
    const r = parseRobotsTxt(`User-Agent: GPTBot
Disallow: /private
`)
    expect(r.groups[0]?.uaTokens.has('gptbot')).toBe(true)
  })
})

describe('checkBotAccess', () => {
  it('returns explicitly_blocked when bot-specific Disallow: / exists', () => {
    const r = parseRobotsTxt(`User-agent: GPTBot
Disallow: /
`)
    const v = checkBotAccess(r, 'gptbot')
    expect(v.verdict).toBe('explicitly_blocked')
    expect(v.matchedGroup).toBe('specific')
  })

  it('returns wildcard_blocked when only the * group disallows root', () => {
    const r = parseRobotsTxt(`User-agent: *
Disallow: /
`)
    const v = checkBotAccess(r, 'perplexitybot')
    expect(v.verdict).toBe('wildcard_blocked')
    expect(v.matchedGroup).toBe('wildcard')
  })

  it('returns allowed when no group applies', () => {
    const r = parseRobotsTxt(`User-agent: Googlebot
Disallow: /search
`)
    const v = checkBotAccess(r, 'gptbot')
    expect(v.verdict).toBe('allowed')
    expect(v.matchedGroup).toBe('none')
  })

  it('returns restricted when bot-specific group has subpath disallows but root open', () => {
    const r = parseRobotsTxt(`User-agent: GPTBot
Disallow: /admin
Disallow: /private
`)
    const v = checkBotAccess(r, 'gptbot')
    expect(v.verdict).toBe('restricted')
    expect(v.disallowPaths).toEqual(['/admin', '/private'])
  })

  it('bot-specific group wins over wildcard (precedence)', () => {
    const r = parseRobotsTxt(`User-agent: *
Disallow: /

User-agent: GPTBot
Disallow:
`)
    // GPTBot has an empty Disallow → explicitly allowed even though * blocks.
    const v = checkBotAccess(r, 'gptbot')
    expect(v.verdict).toBe('allowed')
    expect(v.matchedGroup).toBe('specific')
  })

  it('falls through to wildcard when bot is not named', () => {
    const r = parseRobotsTxt(`User-agent: *
Disallow: /admin
`)
    const v = checkBotAccess(r, 'claudebot')
    expect(v.verdict).toBe('restricted')
    expect(v.matchedGroup).toBe('wildcard')
  })

  it('returns allowed by default when robots.txt has no rules', () => {
    const r = parseRobotsTxt('')
    const v = checkBotAccess(r, 'gptbot')
    expect(v.verdict).toBe('allowed')
    expect(v.matchedGroup).toBe('none')
  })
})

describe('auditRobotsForAiBots', () => {
  it('returns verdicts for every AI_BOT in the list', () => {
    const r = parseRobotsTxt(`User-agent: *
Disallow:
`)
    const verdicts = auditRobotsForAiBots(r)
    expect(verdicts).toHaveLength(AI_BOTS.length)
  })

  it('sorts blocked bots first, then restricted, then allowed', () => {
    const r = parseRobotsTxt(`User-agent: GPTBot
Disallow: /

User-agent: PerplexityBot
Disallow: /private

User-agent: *
Disallow:
`)
    const verdicts = auditRobotsForAiBots(r)
    // GPTBot must come before PerplexityBot which must come before any allowed bot.
    const gptIdx = verdicts.findIndex((v) => v.bot.id === 'gptbot')
    const ppIdx = verdicts.findIndex((v) => v.bot.id === 'perplexitybot')
    const allowedIdx = verdicts.findIndex((v) => v.verdict === 'allowed')
    expect(gptIdx).toBeLessThan(ppIdx)
    expect(ppIdx).toBeLessThan(allowedIdx)
  })
})

describe('AI_BOTS catalog', () => {
  it('covers all four monitored engines', () => {
    const engines = new Set(AI_BOTS.map((b) => b.engine))
    expect(engines.has('chatgpt')).toBe(true)
    expect(engines.has('perplexity')).toBe(true)
    expect(engines.has('claude')).toBe(true)
    expect(engines.has('gemini')).toBe(true)
  })

  it('all bot ids are lowercase', () => {
    for (const b of AI_BOTS) {
      expect(b.id).toBe(b.id.toLowerCase())
    }
  })
})
