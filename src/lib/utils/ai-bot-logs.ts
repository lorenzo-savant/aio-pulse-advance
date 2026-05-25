// AI bot access-log parser. Operator pastes raw access logs (Apache
// Combined, Nginx default, Cloudflare CSV/JSON, or a custom CSV) and we
// tally how often each known AI bot fetched each URL.
//
// Pure util, runs in browser or node — no I/O, no fetch. The bot list
// covers the User-Agents that LLM crawlers actually present today.
// Keep this list in sync with reality: see
// https://platform.openai.com/docs/bots, Anthropic's UA docs, etc.

export interface AIBotMatcher {
  // Canonical bot name shown in the UI.
  name: string
  // Owner / company.
  owner: string
  // Substring (or regex source) matched against the UA header. Match is
  // case-insensitive, anchored on substring presence.
  needle: string
  // How the bot is used (web index, on-demand fetch for user prompts,
  // training corpus collection). Helps the operator interpret the data.
  purpose: 'index' | 'on_demand' | 'training' | 'preview'
}

export const AI_BOTS: AIBotMatcher[] = [
  { name: 'GPTBot', owner: 'OpenAI', needle: 'gptbot', purpose: 'training' },
  { name: 'OAI-SearchBot', owner: 'OpenAI', needle: 'oai-searchbot', purpose: 'index' },
  { name: 'ChatGPT-User', owner: 'OpenAI', needle: 'chatgpt-user', purpose: 'on_demand' },
  { name: 'ClaudeBot', owner: 'Anthropic', needle: 'claudebot', purpose: 'training' },
  { name: 'Claude-Web', owner: 'Anthropic', needle: 'claude-web', purpose: 'on_demand' },
  { name: 'anthropic-ai', owner: 'Anthropic', needle: 'anthropic-ai', purpose: 'training' },
  { name: 'PerplexityBot', owner: 'Perplexity', needle: 'perplexitybot', purpose: 'index' },
  { name: 'Perplexity-User', owner: 'Perplexity', needle: 'perplexity-user', purpose: 'on_demand' },
  { name: 'Google-Extended', owner: 'Google', needle: 'google-extended', purpose: 'training' },
  { name: 'GoogleOther', owner: 'Google', needle: 'googleother', purpose: 'index' },
  { name: 'CCBot', owner: 'CommonCrawl', needle: 'ccbot', purpose: 'training' },
  { name: 'Bytespider', owner: 'ByteDance', needle: 'bytespider', purpose: 'training' },
  { name: 'FacebookBot', owner: 'Meta', needle: 'facebookbot', purpose: 'training' },
  { name: 'Meta-ExternalAgent', owner: 'Meta', needle: 'meta-externalagent', purpose: 'training' },
  { name: 'Applebot-Extended', owner: 'Apple', needle: 'applebot-extended', purpose: 'training' },
  { name: 'cohere-ai', owner: 'Cohere', needle: 'cohere-ai', purpose: 'training' },
  { name: 'MistralAI-User', owner: 'Mistral', needle: 'mistralai-user', purpose: 'on_demand' },
  { name: 'YouBot', owner: 'You.com', needle: 'youbot', purpose: 'index' },
  { name: 'Bingbot (AI snapshot)', owner: 'Microsoft', needle: 'bingbot', purpose: 'index' },
  { name: 'Diffbot', owner: 'Diffbot', needle: 'diffbot', purpose: 'training' },
  { name: 'omgili', owner: 'Webz', needle: 'omgili', purpose: 'training' },
  { name: 'PetalBot', owner: 'Huawei', needle: 'petalbot', purpose: 'index' },
]

export interface LogEntry {
  ts: string | null // raw timestamp string as it appeared (no parse)
  path: string
  status: number | null
  userAgent: string
}

export interface BotHit {
  bot: AIBotMatcher
  entry: LogEntry
}

// Apache/Nginx Combined Log Format. Example:
// 192.168.1.1 - - [25/May/2026:13:42:11 +0000] "GET /pricing HTTP/1.1" 200 1234 "-" "PerplexityBot/1.0"
const COMBINED_RE =
  /^\S+\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"(?:GET|POST|HEAD|PUT|DELETE|OPTIONS|PATCH)\s+([^"\s]+)\s+HTTP\/[\d.]+"\s+(\d{3})\s+\S+\s+"[^"]*"\s+"([^"]*)"/i

function parseCombined(line: string): LogEntry | null {
  const m = COMBINED_RE.exec(line)
  if (!m) return null
  return {
    ts: m[1] ?? null,
    path: m[2] ?? '',
    status: m[3] ? parseInt(m[3], 10) : null,
    userAgent: m[4] ?? '',
  }
}

function splitCsv(line: string): string[] {
  // Minimal CSV splitter — handles "" escapes inside quoted fields.
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') {
        inQ = false
      } else {
        cur += c
      }
    } else {
      if (c === ',') {
        out.push(cur)
        cur = ''
      } else if (c === '"') {
        inQ = true
      } else {
        cur += c
      }
    }
  }
  out.push(cur)
  return out
}

function parseCsv(lines: string[]): LogEntry[] {
  if (lines.length === 0) return []
  const headerLine = lines[0]
  if (!headerLine) return []
  const header = splitCsv(headerLine).map((h) => h.trim().toLowerCase())
  const findIdx = (...names: string[]) =>
    header.findIndex((h) => names.some((n) => h === n || h.includes(n)))
  const uaIdx = findIdx('user_agent', 'useragent', 'user-agent', 'agent', 'ua')
  if (uaIdx < 0) return []
  const pathIdx = findIdx('path', 'uri', 'url', 'request', 'request_uri')
  const tsIdx = findIdx('timestamp', 'time', 'datetime', 'date')
  const statusIdx = findIdx('status', 'response_status', 'http_status')

  const out: LogEntry[] = []
  for (let i = 1; i < lines.length; i++) {
    const ln = lines[i]
    if (!ln) continue
    const cols = splitCsv(ln)
    const ua = (cols[uaIdx] ?? '').trim()
    if (!ua) continue
    out.push({
      ts: tsIdx >= 0 ? (cols[tsIdx] ?? null) : null,
      path: pathIdx >= 0 ? (cols[pathIdx] ?? '').trim() : '',
      status: statusIdx >= 0 ? parseInt(cols[statusIdx] ?? '', 10) || null : null,
      userAgent: ua,
    })
  }
  return out
}

export function parseLogs(raw: string): LogEntry[] {
  if (!raw || !raw.trim()) return []
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []

  // Detect format by looking at the first non-empty line. If it parses
  // as Combined, treat the whole block as Combined; otherwise try CSV.
  const first = lines[0]
  if (first && COMBINED_RE.test(first)) {
    const out: LogEntry[] = []
    for (const ln of lines) {
      const p = parseCombined(ln)
      if (p) out.push(p)
    }
    return out
  }
  return parseCsv(lines)
}

export function matchBot(userAgent: string): AIBotMatcher | null {
  if (!userAgent) return null
  const ua = userAgent.toLowerCase()
  for (const b of AI_BOTS) {
    if (ua.includes(b.needle)) return b
  }
  return null
}

export interface BotSummary {
  bot: AIBotMatcher
  hits: number
  uniquePaths: number
  errorRate: number
  topPaths: Array<{ path: string; hits: number }>
}

export interface LogAnalysis {
  totalLines: number
  totalBotHits: number
  perBot: BotSummary[]
  // Most-crawled paths regardless of which bot — helps see if AI bots
  // converge on the same content.
  topPaths: Array<{ path: string; hits: number; bots: string[] }>
  // Lines that parsed successfully but didn't match any known bot —
  // shown as a hint so the operator knows nothing was silently dropped.
  unknownAgents: number
}

export function analyzeLogs(raw: string, topN = 10): LogAnalysis {
  const entries = parseLogs(raw)
  const perBotMap = new Map<string, { bot: AIBotMatcher; entries: LogEntry[] }>()
  let unknown = 0
  for (const e of entries) {
    const bot = matchBot(e.userAgent)
    if (!bot) {
      unknown++
      continue
    }
    let cur = perBotMap.get(bot.name)
    if (!cur) {
      cur = { bot, entries: [] }
      perBotMap.set(bot.name, cur)
    }
    cur.entries.push(e)
  }

  const perBot: BotSummary[] = []
  const pathHits = new Map<string, { hits: number; bots: Set<string> }>()
  for (const { bot, entries: list } of perBotMap.values()) {
    const pathMap = new Map<string, number>()
    let errors = 0
    for (const e of list) {
      const p = e.path || '(no path)'
      pathMap.set(p, (pathMap.get(p) ?? 0) + 1)
      if (e.status && e.status >= 400) errors++
      let agg = pathHits.get(p)
      if (!agg) {
        agg = { hits: 0, bots: new Set() }
        pathHits.set(p, agg)
      }
      agg.hits++
      agg.bots.add(bot.name)
    }
    const topPaths = Array.from(pathMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([path, hits]) => ({ path, hits }))
    perBot.push({
      bot,
      hits: list.length,
      uniquePaths: pathMap.size,
      errorRate: list.length > 0 ? Math.round((errors / list.length) * 1000) / 10 : 0,
      topPaths,
    })
  }
  perBot.sort((a, b) => b.hits - a.hits)

  const topPaths = Array.from(pathHits.entries())
    .sort((a, b) => b[1].hits - a[1].hits)
    .slice(0, topN)
    .map(([path, v]) => ({ path, hits: v.hits, bots: Array.from(v.bots).sort() }))

  return {
    totalLines: entries.length,
    totalBotHits: entries.length - unknown,
    perBot,
    topPaths,
    unknownAgents: unknown,
  }
}
