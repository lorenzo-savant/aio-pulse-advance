import { describe, it, expect } from 'vitest'
import { parseLogs, matchBot, analyzeLogs, AI_BOTS } from '@/lib/utils/ai-bot-logs'

const COMBINED_SAMPLE = `192.168.1.1 - - [25/May/2026:13:42:11 +0000] "GET /pricing HTTP/1.1" 200 1234 "-" "PerplexityBot/1.0"
10.0.0.2 - - [25/May/2026:13:43:00 +0000] "GET /blog/post HTTP/1.1" 200 5678 "-" "Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)"
10.0.0.3 - - [25/May/2026:13:44:00 +0000] "GET /robots.txt HTTP/1.1" 200 100 "-" "ClaudeBot/1.0"
10.0.0.4 - - [25/May/2026:13:45:00 +0000] "GET / HTTP/1.1" 404 50 "-" "GPTBot/1.0"
10.0.0.5 - - [25/May/2026:13:46:00 +0000] "GET /pricing HTTP/1.1" 200 1234 "-" "GPTBot/1.0"
10.0.0.6 - - [25/May/2026:13:47:00 +0000] "GET /about HTTP/1.1" 200 800 "-" "Mozilla/5.0 (compatible; Googlebot/2.1)"`

const CSV_SAMPLE = `timestamp,path,status,user_agent
2026-05-25T13:42:11Z,/pricing,200,PerplexityBot/1.0
2026-05-25T13:43:00Z,/blog/post,200,"Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)"
2026-05-25T13:43:30Z,/blog/post,200,"Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)"
2026-05-25T13:44:00Z,/,200,Mozilla/5.0 Chrome/120
`

describe('matchBot', () => {
  it('matches by case-insensitive UA needle', () => {
    expect(matchBot('PerplexityBot/1.0')?.name).toBe('PerplexityBot')
    expect(matchBot('PERPLEXITYBOT')?.name).toBe('PerplexityBot')
    expect(matchBot('GPTBot/1.0')?.name).toBe('GPTBot')
  })

  it('returns null for non-AI bots and humans', () => {
    expect(matchBot('Mozilla/5.0 Chrome/120')).toBeNull()
    expect(matchBot('Googlebot/2.1')).toBeNull()
    expect(matchBot('')).toBeNull()
  })

  it('covers a representative set of LLM crawlers', () => {
    const expected = ['gptbot', 'claudebot', 'perplexitybot', 'ccbot', 'google-extended']
    for (const n of expected) {
      expect(AI_BOTS.some((b) => b.needle === n)).toBe(true)
    }
  })
})

describe('parseLogs', () => {
  it('parses Apache Combined Log Format', () => {
    const out = parseLogs(COMBINED_SAMPLE)
    expect(out.length).toBe(6)
    expect(out[0]!.path).toBe('/pricing')
    expect(out[0]!.status).toBe(200)
    expect(out[0]!.userAgent).toContain('PerplexityBot')
  })

  it('parses CSV with header detection', () => {
    const out = parseLogs(CSV_SAMPLE)
    expect(out.length).toBe(4)
    expect(out[0]!.path).toBe('/pricing')
    expect(out[1]!.userAgent).toContain('GPTBot')
  })

  it('returns empty for whitespace input', () => {
    expect(parseLogs('')).toEqual([])
    expect(parseLogs('   \n  \n')).toEqual([])
  })
})

describe('analyzeLogs', () => {
  it('groups hits per bot with error rate + unique paths', () => {
    const a = analyzeLogs(COMBINED_SAMPLE)
    expect(a.totalLines).toBe(6)
    expect(a.unknownAgents).toBe(1) // the Googlebot line

    const gpt = a.perBot.find((p) => p.bot.name === 'GPTBot')
    expect(gpt).toBeDefined()
    expect(gpt!.hits).toBe(3)
    expect(gpt!.uniquePaths).toBe(3) // /blog/post, /, /pricing
    expect(gpt!.errorRate).toBeCloseTo(33.3, 0)

    const perplexity = a.perBot.find((p) => p.bot.name === 'PerplexityBot')
    expect(perplexity!.hits).toBe(1)
    expect(perplexity!.errorRate).toBe(0)
  })

  it('top paths aggregate across bots and list the bots that crawled', () => {
    const a = analyzeLogs(COMBINED_SAMPLE)
    const pricing = a.topPaths.find((p) => p.path === '/pricing')
    expect(pricing).toBeDefined()
    expect(pricing!.hits).toBe(2)
    expect(pricing!.bots.sort()).toEqual(['GPTBot', 'PerplexityBot'])
  })

  it('handles CSV input with quoted UA strings', () => {
    const a = analyzeLogs(CSV_SAMPLE)
    const gpt = a.perBot.find((p) => p.bot.name === 'GPTBot')
    expect(gpt!.hits).toBe(2)
    expect(a.unknownAgents).toBe(1) // the Chrome/120 line
  })

  it('returns zeroed analysis for empty input', () => {
    const a = analyzeLogs('')
    expect(a.totalLines).toBe(0)
    expect(a.perBot).toEqual([])
    expect(a.topPaths).toEqual([])
  })
})
