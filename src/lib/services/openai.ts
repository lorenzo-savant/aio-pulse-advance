export function isOpenAIAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

export async function callOpenAI(
  prompt: string,
  options?: { model?: string; temperature?: number },
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
