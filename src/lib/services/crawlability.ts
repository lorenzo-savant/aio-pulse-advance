import { safeFetch } from '@/lib/utils/safe-fetch'

export const AI_BOTS = [
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
] as const

export type BotName = (typeof AI_BOTS)[number]

export interface RobotRule {
  userAgent: string
  disallow: string[]
  allow: string[]
  crawlDelay?: number
}

export interface RobotRules {
  raw: string
  rules: Map<string, RobotRule>
}

export interface BotAccessResult {
  bot: BotName
  allowed: boolean
  reason?: string
}

export interface Recommendation {
  bot: BotName
  action: string
  priority: 'high' | 'medium' | 'low'
}

export interface CrawlabilityResult {
  url: string
  timestamp: string
  score: number
  results: BotAccessResult[]
  recommendations: Recommendation[]
}

function normalizeUserAgent(ua: string): string {
  return ua.toLowerCase().replace(/[*]/g, '.*')
}

function matchUserAgent(botName: string, ruleUa: string): boolean {
  const normalizedRule = normalizeUserAgent(ruleUa)
  const botLower = botName.toLowerCase()

  if (normalizedRule === '.*' || normalizedRule === '*') {
    return true
  }

  if (new RegExp(`^${normalizedRule}`).test(botLower)) {
    return true
  }

  return botLower.startsWith(normalizedRule.replace('.*', ''))
}

function patternToRegex(pattern: string): RegExp {
  const regex = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')

  return new RegExp('^' + regex)
}

export function parseRobotsTxt(content: string): RobotRules {
  const rules = new Map<string, RobotRule>()
  const lines = content.split('\n')

  let currentUa = '*'
  const currentRule: RobotRule = {
    userAgent: '*',
    disallow: [],
    allow: [],
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) continue

    const directive = trimmed.substring(0, colonIndex).trim().toLowerCase()
    const value = trimmed.substring(colonIndex + 1).trim()

    if (directive === 'user-agent') {
      if (
        currentRule.disallow.length > 0 ||
        currentRule.allow.length > 0 ||
        currentRule.crawlDelay !== undefined
      ) {
        const existing = rules.get(currentUa)
        if (existing) {
          existing.disallow.push(...currentRule.disallow)
          existing.allow.push(...currentRule.allow)
          if (currentRule.crawlDelay !== undefined) {
            existing.crawlDelay = currentRule.crawlDelay
          }
        } else {
          rules.set(currentUa, { ...currentRule })
        }
      }
      currentUa = value
      currentRule.userAgent = value
      currentRule.disallow = []
      currentRule.allow = []
      currentRule.crawlDelay = undefined
    } else if (directive === 'disallow') {
      if (value) currentRule.disallow.push(value)
    } else if (directive === 'allow') {
      if (value) currentRule.allow.push(value)
    } else if (directive === 'crawl-delay') {
      const delay = parseFloat(value)
      if (!isNaN(delay)) {
        currentRule.crawlDelay = delay
      }
    }
  }

  if (
    currentRule.disallow.length > 0 ||
    currentRule.allow.length > 0 ||
    currentRule.crawlDelay !== undefined
  ) {
    const existing = rules.get(currentUa)
    if (existing) {
      existing.disallow.push(...currentRule.disallow)
      existing.allow.push(...currentRule.allow)
      if (currentRule.crawlDelay !== undefined) {
        existing.crawlDelay = currentRule.crawlDelay
      }
    } else {
      rules.set(currentUa, { ...currentRule })
    }
  }

  return {
    raw: content,
    rules,
  }
}

export function checkBotAccess(rules: RobotRules, bot: BotName, testPath = '/'): boolean {
  const botSpecificRule = rules.rules.get(bot)
  const defaultRule = rules.rules.get('*')

  let patterns: { pattern: string; allowed: boolean }[] = []

  if (botSpecificRule) {
    patterns = [
      ...botSpecificRule.allow.map((p) => ({ pattern: p, allowed: true })),
      ...botSpecificRule.disallow.map((p) => ({ pattern: p, allowed: false })),
    ]
  } else if (defaultRule) {
    patterns = [
      ...defaultRule.allow.map((p) => ({ pattern: p, allowed: true })),
      ...defaultRule.disallow.map((p) => ({ pattern: p, allowed: false })),
    ]
  }

  if (patterns.length === 0) {
    return true
  }

  patterns.sort((a, b) => {
    const aWildcards = (a.pattern.match(/\*/g) || []).length
    const bWildcards = (b.pattern.match(/\*/g) || []).length
    return bWildcards - aWildcards
  })

  for (const { pattern, allowed } of patterns) {
    const regex = patternToRegex(pattern)
    if (regex.test(testPath)) {
      return allowed
    }
  }

  return true
}

export function checkAllBots(
  rules: RobotRules,
  bots: readonly BotName[] = AI_BOTS,
  testPath = '/',
): BotAccessResult[] {
  return bots.map((bot) => ({
    bot,
    allowed: checkBotAccess(rules, bot, testPath),
  }))
}

export function calculateCrawlabilityScore(results: BotAccessResult[]): number {
  if (results.length === 0) return 0
  const allowed = results.filter((r) => r.allowed).length
  return Math.round((allowed / results.length) * 100)
}

export function getRecommendations(results: BotAccessResult[]): Recommendation[] {
  return results
    .filter((r) => !r.allowed)
    .map((r) => ({
      bot: r.bot,
      action: `Allow ${r.bot} in robots.txt`,
      priority: getPriority(r.bot),
    }))
}

function getPriority(bot: BotName): 'high' | 'medium' | 'low' {
  const highPriority = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']
  const mediumPriority = ['Bingbot', 'Yandex', 'DuckBot']

  if (highPriority.includes(bot)) return 'high'
  if (mediumPriority.includes(bot)) return 'medium'
  return 'low'
}

export async function checkCrawlability(url: string): Promise<CrawlabilityResult> {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error('Invalid URL provided')
  }

  const robotsUrl = new URL('/robots.txt', parsedUrl.origin)

  try {
    const response = await safeFetch(robotsUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      },
    })

    const content = response.ok ? await response.text() : ''
    const rules = parseRobotsTxt(content)
    const results = checkAllBots(rules)
    const score = calculateCrawlabilityScore(results)
    const recommendations = getRecommendations(results)

    return {
      url: parsedUrl.origin,
      timestamp: new Date().toISOString(),
      score,
      results,
      recommendations,
    }
  } catch (error) {
    throw new Error(`Failed to fetch robots.txt: ${error}`)
  }
}
