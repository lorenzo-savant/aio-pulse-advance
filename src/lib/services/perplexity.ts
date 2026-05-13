import { safeFetch } from '@/lib/utils/safe-fetch'

export function isPerplexityAvailable(): boolean {
  return Boolean(process.env.PERPLEXITY_API_KEY)
}

interface PerplexityResponse {
  choices?: Array<{ message?: { content?: string } }>
  citations?: string[]
  search_results?: Array<{ url?: string }>
}

export async function callPerplexity(prompt: string): Promise<string> {
  const { text } = await callPerplexityWithCitations(prompt)
  return text
}

export async function callPerplexityWithCitations(
  prompt: string,
): Promise<{ text: string; citations: string[] }> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY not configured')

  const res = await safeFetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2048,
      return_citations: true,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) throw new Error(`Perplexity API error ${res.status}`)

  const data = (await res.json()) as PerplexityResponse

  // Perplexity returns real web citations in `citations` (or `search_results`)
  const citations = (data.citations || [])
    .concat((data.search_results || []).map((s) => s.url || ''))
    .filter((u): u is string => typeof u === 'string' && u.length > 0)

  return {
    text: data.choices?.[0]?.message?.content || '',
    citations,
  }
}
