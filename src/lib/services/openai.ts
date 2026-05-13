import { safeFetch } from '@/lib/utils/safe-fetch'

export function isOpenAIAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

// ─── Web-search-grounded call via Responses API ─────────────────────────────
// Returns the combined output text plus any URL citations collected from
// `annotations` with type = 'url_citation'. Falls back to chat-completions
// (no citations) if the Responses API call fails.
interface ResponsesApiOutput {
  output?: Array<{
    content?: Array<{
      text?: string
      annotations?: Array<{ type?: string; url?: string }>
    }>
  }>
  output_text?: string
}

export async function callOpenAIWithWebSearch(
  prompt: string,
  options?: { model?: string },
): Promise<{ text: string; citations: string[] }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const res = await safeFetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options?.model || 'gpt-4o-mini',
      input: prompt,
      tools: [{ type: 'web_search_preview' }],
    }),
    signal: AbortSignal.timeout(45_000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI Responses API error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = (await res.json()) as ResponsesApiOutput

  const citations = new Set<string>()
  let text = data.output_text || ''

  for (const out of data.output || []) {
    for (const c of out.content || []) {
      if (c.text && !text) text += c.text
      for (const a of c.annotations || []) {
        if (a.type === 'url_citation' && a.url) citations.add(a.url)
      }
    }
  }

  return { text, citations: [...citations] }
}

export async function callOpenAI(
  prompt: string,
  options?: { model?: string; temperature?: number },
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const res = await safeFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options?.model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: options?.temperature ?? 0.3,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${error}`)
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content || ''
}
