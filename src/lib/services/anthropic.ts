import { safeFetch } from '@/lib/utils/safe-fetch'

export function isAnthropicAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
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
