// PATH: src/lib/services/cerebras.ts
// Cerebras AI client — FREE tier: 1 000 000 tokens/giorno, nessuna carta.
// Specialità: inferenza ULTRA VELOCE (5-10x più veloce di GPT-4).
// Setup: https://cloud.cerebras.ai → crea account → genera API key
// Aggiungi in .env.local: CEREBRAS_API_KEY=csk_...

interface CerebrasMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface CerebrasChoice {
  message: CerebrasMessage
  finish_reason: string
  index: number
}

interface CerebrasUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

interface CerebrasResponse {
  id: string
  object: string
  created: number
  model: string
  choices: CerebrasChoice[]
  usage: CerebrasUsage
}

export const CEREBRAS_MODELS = {
  LLAMA_8B: 'llama-3.1-8b',
  LLAMA_70B: 'llama-3.3-70b',
} as const

export type CerebrasModel = (typeof CEREBRAS_MODELS)[keyof typeof CEREBRAS_MODELS]

export async function callCerebras(
  prompt: string,
  options: {
    model?: CerebrasModel
    temperature?: number
    maxTokens?: number
    systemPrompt?: string
  } = {},
): Promise<string> {
  const apiKey = process.env['CEREBRAS_API_KEY']
  if (!apiKey) {
    throw new Error(
      'CEREBRAS_API_KEY non configurata. Aggiungila in .env.local\n' +
        'Ottieni una chiave gratuita su: https://cloud.cerebras.ai',
    )
  }

  const {
    model = CEREBRAS_MODELS.LLAMA_8B,
    temperature = 0.2,
    maxTokens = 2048,
    systemPrompt,
  } = options

  const messages: CerebrasMessage[] = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })

  const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }),
    signal: AbortSignal.timeout(8_000),
  })

  if (!res.ok) {
    const errText = await res.text()
    if (res.status === 429) {
      throw new Error(
        `Cerebras rate limit raggiunto (${res.status}). ` +
          'Limite giornaliero di 1 000 000 token esaurito. ' +
          'Il limite si resetta a mezzanotte UTC.',
      )
    }
    throw new Error(`Cerebras API error ${res.status}: ${errText}`)
  }

  const data = (await res.json()) as CerebrasResponse
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Risposta vuota da Cerebras API')
  return text
}

export function isCerebrasAvailable(): boolean {
  const key = process.env['CEREBRAS_API_KEY']
  return Boolean(key && key.trim().length > 0)
}
