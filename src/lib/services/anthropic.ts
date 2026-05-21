import { safeFetch } from '@/lib/utils/safe-fetch'

export function isAnthropicAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

// ─── Web-search-grounded call ────────────────────────────────────────────────
// Uses Claude's server-side web_search tool so the answer reflects the LIVE web
// (what Claude actually surfaces today) instead of model memory — and returns
// the real source URLs Claude cited. Locale-aware via user_location. Falls back
// to the plain call upstream if this throws.
interface AnthropicContentBlock {
  type?: string
  text?: string
  // text blocks carry inline citations to the web results they drew on
  citations?: Array<{ type?: string; url?: string }>
  // web_search_tool_result blocks carry the raw result list
  content?: Array<{ type?: string; url?: string }>
}

export async function callAnthropicWithWebSearch(
  prompt: string,
  options?: { model?: string; country?: string },
): Promise<{ text: string; citations: string[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const webSearchTool: Record<string, unknown> = {
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: 3,
  }
  if (options?.country) {
    webSearchTool.user_location = { type: 'approximate', country: options.country }
  }

  const res = await safeFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options?.model || 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
      tools: [webSearchTool],
    }),
    signal: AbortSignal.timeout(45_000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic web-search error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = (await res.json()) as { content?: AnthropicContentBlock[] }
  const citations = new Set<string>()
  let text = ''

  for (const block of data.content || []) {
    if (block.type === 'text' && block.text) {
      text += block.text
      for (const c of block.citations || []) {
        if (c.url) citations.add(c.url)
      }
    }
    // web_search_tool_result block holds the result list Claude searched.
    for (const r of block.content || []) {
      if (r.type === 'web_search_result' && r.url) citations.add(r.url)
    }
  }

  return { text: text.trim(), citations: [...citations] }
}

export async function callAnthropic(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const res = await safeFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) throw new Error(`Anthropic API error ${res.status}`)

  const data = (await res.json()) as { content?: Array<{ text?: string }> }
  return data.content?.[0]?.text || ''
}
