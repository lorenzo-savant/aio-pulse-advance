import { describe, it, expect } from 'vitest'
import {
  parseRobotsTxt,
  checkBotAccess,
  checkAllBots,
  calculateCrawlabilityScore,
  getRecommendations,
  AI_BOTS,
  type BotAccessResult,
  type BotName,
} from '@/lib/services/crawlability'

describe('Crawlability Service', () => {
  describe('parseRobotsTxt', () => {
    it('parses empty robots.txt', () => {
      const rules = parseRobotsTxt('')
      expect(rules.rules.size).toBe(0)
    })

    it('parses basic robots.txt with disallow', () => {
      const content = `
User-agent: *
Disallow: /admin/
Disallow: /private/
      `.trim()
      const rules = parseRobotsTxt(content)
      const defaultRule = rules.rules.get('*')
      expect(defaultRule?.disallow).toContain('/admin/')
      expect(defaultRule?.disallow).toContain('/private/')
    })

    it('parses bot-specific rules', () => {
      const content = `
User-agent: GPTBot
Disallow: /private/

User-agent: *
Disallow: /admin/
      `.trim()
      const rules = parseRobotsTxt(content)
      const gptRule = rules.rules.get('GPTBot')
      const defaultRule = rules.rules.get('*')
      expect(gptRule?.disallow).toContain('/private/')
      expect(defaultRule?.disallow).toContain('/admin/')
    })

    it('parses allow and disallow rules', () => {
      const content = `
User-agent: *
Allow: /public/
Disallow: /private/
      `.trim()
      const rules = parseRobotsTxt(content)
      const defaultRule = rules.rules.get('*')
      expect(defaultRule?.allow).toContain('/public/')
      expect(defaultRule?.disallow).toContain('/private/')
    })

    it('parses crawl-delay', () => {
      const content = `
User-agent: *
Crawl-delay: 10
      `.trim()
      const rules = parseRobotsTxt(content)
      const defaultRule = rules.rules.get('*')
      expect(defaultRule?.crawlDelay).toBe(10)
    })
  })

  describe('checkBotAccess', () => {
    it('allows access when no rules defined', () => {
      const rules = parseRobotsTxt('')
      const allowed = checkBotAccess(rules, 'GPTBot', '/')
      expect(allowed).toBe(true)
    })

    it('blocks path defined in disallow', () => {
      const content = `
User-agent: *
Disallow: /admin/
      `.trim()
      const rules = parseRobotsTxt(content)
      const allowed = checkBotAccess(rules, 'GPTBot', '/admin/login')
      expect(allowed).toBe(false)
    })

    it('allows path defined in allow even with disallow', () => {
      const content = `
User-agent: *
Allow: /public/
Disallow: /
      `.trim()
      const rules = parseRobotsTxt(content)
      const allowed = checkBotAccess(rules, 'GPTBot', '/public/page')
      expect(allowed).toBe(true)
    })

    it('uses bot-specific rules when available', () => {
      const content = `
User-agent: GPTBot
Disallow: /secret/

User-agent: *
Allow: /
      `.trim()
      const rules = parseRobotsTxt(content)
      const gptAllowed = checkBotAccess(rules, 'GPTBot', '/secret/')
      const otherAllowed = checkBotAccess(rules, 'ClaudeBot', '/secret/')
      expect(gptAllowed).toBe(false)
      expect(otherAllowed).toBe(true)
    })

    it('handles wildcard user-agent', () => {
      const content = `
User-agent: *
Disallow: /api/
      `.trim()
      const rules = parseRobotsTxt(content)
      const allowed = checkBotAccess(rules, 'Yandex', '/api/data')
      expect(allowed).toBe(false)
    })
  })

  describe('checkAllBots', () => {
    it('checks all 13 AI bots', () => {
      const rules = parseRobotsTxt('')
      const results = checkAllBots(rules)
      expect(results.length).toBe(13)
      expect(results.every((r) => r.allowed)).toBe(true)
    })

    it('detects blocked bots correctly', () => {
      const content = `
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: *
Allow: /
      `.trim()
      const rules = parseRobotsTxt(content)
      const results = checkAllBots(rules)
      const gpt = results.find((r) => r.bot === 'GPTBot')
      const claude = results.find((r) => r.bot === 'ClaudeBot')
      const google = results.find((r) => r.bot === 'Google-Extended')
      const other = results.find((r) => r.bot === 'PerplexityBot')
      expect(gpt?.allowed).toBe(false)
      expect(claude?.allowed).toBe(false)
      expect(google?.allowed).toBe(false)
      expect(other?.allowed).toBe(true)
    })
  })

  describe('calculateCrawlabilityScore', () => {
    it('returns 100 when all bots allowed', () => {
      const results: BotAccessResult[] = [
        { bot: 'GPTBot', allowed: true },
        { bot: 'ClaudeBot', allowed: true },
      ]
      const score = calculateCrawlabilityScore(results)
      expect(score).toBe(100)
    })

    it('returns 0 when all bots blocked', () => {
      const results: BotAccessResult[] = [
        { bot: 'GPTBot', allowed: false },
        { bot: 'ClaudeBot', allowed: false },
      ]
      const score = calculateCrawlabilityScore(results)
      expect(score).toBe(0)
    })

    it('returns correct percentage', () => {
      const results: BotAccessResult[] = [
        { bot: 'GPTBot', allowed: true },
        { bot: 'ClaudeBot', allowed: false },
        { bot: 'PerplexityBot', allowed: true },
        { bot: 'Google-Extended', allowed: false },
      ]
      const score = calculateCrawlabilityScore(results)
      expect(score).toBe(50)
    })

    it('returns 0 for empty results', () => {
      const score = calculateCrawlabilityScore([])
      expect(score).toBe(0)
    })
  })

  describe('getRecommendations', () => {
    it('returns empty when all bots allowed', () => {
      const results: BotAccessResult[] = [
        { bot: 'GPTBot', allowed: true },
        { bot: 'ClaudeBot', allowed: true },
      ]
      const recommendations = getRecommendations(results)
      expect(recommendations).toHaveLength(0)
    })

    it('returns recommendation for blocked bots', () => {
      const results: BotAccessResult[] = [
        { bot: 'GPTBot', allowed: false },
        { bot: 'ClaudeBot', allowed: true },
      ]
      const recommendations = getRecommendations(results)
      expect(recommendations).toHaveLength(1)
      expect(recommendations[0]?.bot).toBe('GPTBot')
      expect(recommendations[0]?.action).toBe('Allow GPTBot in robots.txt')
    })

    it('sets high priority for major AI bots', () => {
      const results: BotAccessResult[] = [
        { bot: 'GPTBot', allowed: false },
        { bot: 'PerplexityBot', allowed: false },
        { bot: 'Bingbot', allowed: false },
      ]
      const recommendations = getRecommendations(results)
      const gpt = recommendations.find((r) => r.bot === 'GPTBot')
      const bing = recommendations.find((r) => r.bot === 'Bingbot')
      expect(gpt?.priority).toBe('high')
      expect(bing?.priority).toBe('medium')
    })
  })

  describe('AI_BOTS constant', () => {
    it('contains all 13 required bots', () => {
      const expectedBots: BotName[] = [
        'GPTBot',
        'ClaudeBot',
        'PerplexityBot',
        'Google-Extended',
        'CCBot',
        'Applebot-Extended',
        'Amazonbot',
        'AdsBot-Google',
        'DuckBot',
        'FacebookBot',
        'TwitterBot',
        'Bingbot',
        'Yandex',
      ]
      expect(AI_BOTS).toEqual(expectedBots)
    })
  })
})
