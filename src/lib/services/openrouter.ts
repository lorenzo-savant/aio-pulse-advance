// PATH: src/lib/services/openrouter.ts
// OpenRouter client — FREE tier: 50 req/giorno, 25+ modelli, nessuna carta.
// VANTAGGIO: Perplexity su OpenRouter ha accesso INTERNET REALE.
// Setup: https://openrouter.ai → crea account → genera API key
// Aggiungi in .env.local: OPENROUTER_API_KEY=sk-or-v1-...

import type { MonitoringEngine } from '@/types'
import { logger } from '@/lib/logger'

interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface OpenRouterChoice {
  message: OpenRouterMessage
  finish_reason: string
  index: number
}

interface OpenRouterResponse {
  id: string
  model: string
  choices: OpenRouterChoice[]
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

// Mapping engine → modello reale corrispondente
export const ENGINE_TO_MODEL: Record<MonitoringEngine, string> = {
  chatgpt: 'openai/gpt-4o-mini',
  gemini: 'google/gemini-flash-1.5',
  perplexity: 'perplexity/llama-3.1-sonar-small-128k-online',
  claude: 'anthropic/claude-3.5-sonnet',
}

export const OPENROUTER_MODELS = {
  GPT4O_MINI: 'openai/gpt-4o-mini',
  GPT4O: 'openai/gpt-4o',
  CLAUDE_SONNET: 'anthropic/claude-3.5-sonnet',
} as const

// Fallback completamente gratuiti (no crediti richiesti)
export const ENGINE_TO_FALLBACK_MODEL: Record<MonitoringEngine, string> = {
  chatgpt: 'meta-llama/llama-3.2-3b-instruct:free',
  gemini: 'google/gemma-2-9b-it:free',
  perplexity: 'mistralai/mistral-7b-instruct:free',
  claude: 'anthropic/claude-3.5-sonnet',
}

export async function callOpenRouter(
  prompt: string,
  options: {
    model: string
    temperature?: number
    maxTokens?: number
    systemPrompt?: string
  },
): Promise<string> {
  const apiKey = process.env['OPENROUTER_API_KEY']
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY non configurata. Aggiungila in .env.local\n' +
        'Ottieni una chiave gratuita su: https://openrouter.ai',
    )
  }

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'
  const { model, temperature = 0.3, maxTokens = 2048, systemPrompt } = options

  const messages: OpenRouterMessage[] = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': appUrl,
      'X-Title': 'AIO Pulse',
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(45_000), // Perplexity con search può essere lento
  })

  if (!res.ok) {
    const errText = await res.text()
    if (res.status === 429) {
      throw new Error(
        `OpenRouter rate limit raggiunto (${res.status}). ` +
          'Limite di 50 richieste/giorno esaurito.',
      )
    }
    if (res.status === 402) {
      throw new Error(
        `OpenRouter: crediti esauriti per il modello "${model}". ` +
          'Prova un modello con suffisso :free',
      )
    }
    throw new Error(`OpenRouter API error ${res.status}: ${errText}`)
  }

  const data = (await res.json()) as OpenRouterResponse
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Risposta vuota da OpenRouter API')
  return text
}

export async function callOpenRouterForEngine(
  prompt: string,
  engine: MonitoringEngine,
  temperature = 0.3,
): Promise<string> {
  const primaryModel = ENGINE_TO_MODEL[engine]
  try {
    return await callOpenRouter(prompt, { model: primaryModel, temperature })
  } catch (err) {
    const fallbackModel = ENGINE_TO_FALLBACK_MODEL[engine]
    logger.warn('Primary model failed, trying fallback', { service: 'openrouter', primaryModel, fallbackModel, error: err instanceof Error ? err.message : err })
    return await callOpenRouter(prompt, { model: fallbackModel, temperature })
  }
}

export function isOpenRouterAvailable(): boolean {
  const key = process.env['OPENROUTER_API_KEY']
  return Boolean(key && key.trim().length > 0)
}

export const FREE_MODELS_LIST = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (OpenAI)', engine: 'chatgpt' },
  { id: 'google/gemini-flash-1.5', name: 'Gemini 1.5 Flash (Google)', engine: 'gemini' },
  {
    id: 'perplexity/llama-3.1-sonar-small-128k-online',
    name: 'Perplexity Sonar Online (web real)',
    engine: 'perplexity',
  },
  {
    id: 'meta-llama/llama-3.2-3b-instruct:free',
    name: 'Llama 3.2 3B (Meta, free)',
    engine: 'fallback',
  },
  { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (Google, free)', engine: 'fallback' },
  {
    id: 'mistralai/mistral-7b-instruct:free',
    name: 'Mistral 7B (Mistral AI, free)',
    engine: 'fallback',
  },
] as const
