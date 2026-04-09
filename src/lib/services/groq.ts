// PATH: src/lib/services/groq.ts
// Groq AI client — FREE tier: 500 000 tokens/giorno, nessuna carta richiesta.
// Setup: https://console.groq.com → crea account → genera API key
// Aggiungi in .env.local: GROQ_API_KEY=gsk_...

interface GroqMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface GroqChoice {
  message: GroqMessage
  finish_reason: string
  index: number
}

interface GroqUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

interface GroqResponse {
  id: string
  object: string
  created: number
  model: string
  choices: GroqChoice[]
  usage: GroqUsage
}

export const GROQ_MODELS = {
  /** Llama 3.3 70B — bilanciato, ottimo per simulazioni */
  LLAMA_70B: 'llama-3.3-70b-versatile',
  /** Llama 3.1 8B — più veloce, meno preciso */
  LLAMA_8B: 'llama-3.1-8b-instant',
  /** Mixtral 8x7B — buono per testi lunghi */
  MIXTRAL: 'mixtral-8x7b-32768',
  /** Gemma 2 9B — modello Google open source */
  GEMMA: 'gemma2-9b-it',
} as const

export type GroqModel = (typeof GROQ_MODELS)[keyof typeof GROQ_MODELS]

export async function callGroq(
  prompt: string,
  options: {
    model?: GroqModel
    temperature?: number
    maxTokens?: number
    systemPrompt?: string
  } = {},
): Promise<string> {
  const apiKey = process.env['GROQ_API_KEY']
  if (!apiKey) {
    throw new Error(
      'GROQ_API_KEY non configurata. Aggiungila in .env.local\n' +
        'Ottieni una chiave gratuita su: https://console.groq.com',
    )
  }

  const {
    model = GROQ_MODELS.LLAMA_70B,
    temperature = 0.2,
    maxTokens = 2048,
    systemPrompt,
  } = options

  const messages: GroqMessage[] = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const errText = await res.text()
    if (res.status === 429) {
      throw new Error(
        `Groq rate limit raggiunto (${res.status}). ` +
          'Limite giornaliero di 500 000 token esaurito. ' +
          'Il limite si resetta a mezzanotte UTC.',
      )
    }
    throw new Error(`Groq API error ${res.status}: ${errText}`)
  }

  const data = (await res.json()) as GroqResponse
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Risposta vuota da Groq API')
  return text
}

export async function callGroqWithMessages(
  messages: GroqMessage[],
  options: { model?: GroqModel; temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const apiKey = process.env['GROQ_API_KEY']
  if (!apiKey) throw new Error('GROQ_API_KEY non configurata')

  const { model = GROQ_MODELS.LLAMA_70B, temperature = 0.3, maxTokens = 2048 } = options

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Groq API error ${res.status}: ${errText}`)
  }

  const data = (await res.json()) as GroqResponse
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Risposta vuota da Groq API')
  return text
}

export function isGroqAvailable(): boolean {
  const key = process.env['GROQ_API_KEY']
  return Boolean(key && key.trim().length > 0)
}