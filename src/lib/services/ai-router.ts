// PATH: src/lib/services/ai-router.ts
// AI Router — seleziona automaticamente il provider disponibile.
//
// SIMULAZIONE engine (step 1):
//   1° OpenRouter (modelli reali) → 2° Groq (Llama 70B) → 3° Gemini (fallback)
//
// ANALISI brand (step 2):
//   1° Cerebras (ultra veloce) → 2° Groq → 3° Gemini (fallback)

import type { MonitoringEngine } from '@/types'
import { callOpenRouterForEngine, isOpenRouterAvailable } from './openrouter'
import { callGroq, isGroqAvailable, GROQ_MODELS } from './groq'
import { callCerebras, isCerebrasAvailable, CEREBRAS_MODELS } from './cerebras'
import { isOpenAIAvailable, callOpenAI } from './openai'
import { isPerplexityAvailable, callPerplexity } from './perplexity'
import { isAnthropicAvailable, callAnthropic } from './anthropic'

async function callGeminiFallback(prompt: string): Promise<string> {
  const apiKey = process.env['GEMINI_API_KEY']
  if (!apiKey) throw new Error('GEMINI_API_KEY non configurata')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) throw new Error(`Gemini API error ${res.status}`)
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Risposta vuota da Gemini')
  return text
}

// ─── simulateEngineResponse ────────────────────────────────────────────────────
// Step 1: simula la risposta dell'engine al prompt.
// Provider: OpenRouter → Groq → Gemini

export async function simulateEngineResponse(
  promptText: string,
  engine: MonitoringEngine,
): Promise<{ text: string; provider: string }> {
  const enginePersona: Record<MonitoringEngine, string> = {
    chatgpt:
      'You are ChatGPT, a helpful AI assistant by OpenAI. Answer conversationally and helpfully. Include relevant brands, products, and services where appropriate.',
    gemini:
      'You are Google Gemini, a helpful AI assistant by Google. Answer factually with well-structured information. Include relevant brands and services where appropriate.',
    perplexity:
      'You are Perplexity AI, a search-focused AI assistant. Answer with verified facts, include brand mentions naturally, and reference sources where possible.',
    claude:
      'You are Claude, a helpful AI assistant by Anthropic. Answer thoughtfully with nuanced analysis. Include relevant brands and services where appropriate, with emphasis on factual accuracy.',
  }

  const fullPrompt = `${enginePersona[engine]}\n\nUser question: "${promptText}"\n\nProvide a realistic, helpful response (150-300 words).`
  const errors: string[] = []

  // Try REAL API first for each engine
  if (engine === 'chatgpt' && isOpenAIAvailable()) {
    try {
      const text = await callOpenAI(fullPrompt)
      return { text, provider: 'openai:gpt-4o-mini' }
    } catch (e) {
      console.warn('[ai-router] OpenAI direct call failed, falling back to simulation:', e)
    }
  }

  if (engine === 'gemini') {
    try {
      const text = await callGeminiFallback(fullPrompt)
      return { text, provider: 'gemini:flash-2.0' }
    } catch (e) {
      console.warn('[ai-router] Gemini direct call failed:', e)
    }
  }

  if (engine === 'perplexity' && isPerplexityAvailable()) {
    try {
      const text = await callPerplexity(fullPrompt)
      return { text, provider: 'perplexity:sonar' }
    } catch (e) {
      console.warn('[ai-router] Perplexity direct call failed, falling back:', e)
    }
  }

  if (engine === 'claude' && isAnthropicAvailable()) {
    try {
      const text = await callAnthropic(fullPrompt)
      return { text, provider: 'anthropic:claude-sonnet' }
    } catch (e) {
      console.warn('[ai-router] Anthropic direct call failed, falling back:', e)
    }
  }

  // FALLBACK to simulation (existing logic with Groq/OpenRouter/Gemini)

  // Tentativo 1: OpenRouter (modelli reali per ogni engine)
  if (isOpenRouterAvailable()) {
    try {
      const text = await callOpenRouterForEngine(fullPrompt, engine)
      return { text, provider: `openrouter:${engine}` }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`OpenRouter: ${msg}`)
      console.warn(`[ai-router] OpenRouter fallito per ${engine}:`, msg)
    }
  }

  // Tentativo 2: Groq (Llama 70B)
  if (isGroqAvailable()) {
    try {
      const text = await callGroq(fullPrompt, {
        model: GROQ_MODELS.LLAMA_70B,
        temperature: 0.3,
        systemPrompt: enginePersona[engine],
      })
      return { text, provider: 'groq:llama-3.3-70b' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`Groq: ${msg}`)
      console.warn(`[ai-router] Groq fallito per ${engine}:`, msg)
    }
  }

  // Tentativo 3: Gemini (fallback finale)
  try {
    const text = await callGeminiFallback(fullPrompt)
    return { text, provider: 'gemini:flash-2.0' }
  } catch (e) {
    errors.push(`Gemini: ${e instanceof Error ? e.message : String(e)}`)
  }

  throw new Error(
    `Tutti i provider AI hanno fallito per la simulazione di "${engine}":\n` +
      errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n'),
  )
}

// ─── analyzeResponseForBrand ──────────────────────────────────────────────────
// Step 2: analizza la risposta per metriche brand.
// Provider: Cerebras → Groq → Gemini

export async function analyzeResponseForBrand(
  analysisPrompt: string,
): Promise<{ text: string; provider: string }> {
  const errors: string[] = []

  // Tentativo 1: Cerebras (ultra veloce, 1M token/giorno)
  if (isCerebrasAvailable()) {
    try {
      const text = await callCerebras(analysisPrompt, {
        model: CEREBRAS_MODELS.LLAMA_8B,
        temperature: 0.1,
        maxTokens: 1024,
      })
      return { text, provider: 'cerebras:llama-3.1-8b' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`Cerebras: ${msg}`)
      console.warn('[ai-router] Cerebras fallito per analisi:', msg)
    }
  }

  // Tentativo 2: Groq
  if (isGroqAvailable()) {
    try {
      const text = await callGroq(analysisPrompt, {
        model: GROQ_MODELS.LLAMA_70B,
        temperature: 0.1,
        maxTokens: 1024,
      })
      return { text, provider: 'groq:llama-3.3-70b' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`Groq: ${msg}`)
      console.warn('[ai-router] Groq fallito per analisi:', msg)
    }
  }

  // Tentativo 3: Gemini (fallback finale)
  try {
    const text = await callGeminiFallback(analysisPrompt)
    return { text, provider: 'gemini:flash-2.0' }
  } catch (e) {
    errors.push(`Gemini: ${e instanceof Error ? e.message : String(e)}`)
  }

  throw new Error(
    "Tutti i provider AI hanno fallito per l'analisi brand:\n" +
      errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n'),
  )
}

// ─── getProviderStatus ────────────────────────────────────────────────────────

export function getProviderStatus() {
  return {
    openrouter: {
      configured: isOpenRouterAvailable(),
      freeLimit: '50 req/giorno',
      bestFor: 'Simulazione con modelli reali (ChatGPT, Gemini, Perplexity)',
      signupUrl: 'https://openrouter.ai',
    },
    groq: {
      configured: isGroqAvailable(),
      freeLimit: '500 000 token/giorno',
      bestFor: 'Simulazione fallback, veloce e affidabile',
      signupUrl: 'https://console.groq.com',
    },
    cerebras: {
      configured: isCerebrasAvailable(),
      freeLimit: '1 000 000 token/giorno',
      bestFor: 'Analisi brand (ultra veloce, JSON parsing)',
      signupUrl: 'https://cloud.cerebras.ai',
    },
    gemini: {
      configured: Boolean(process.env['GEMINI_API_KEY']),
      freeLimit: '10-20 req/giorno (Google AI Studio)',
      bestFor: 'Fallback finale, già integrato',
      signupUrl: 'https://aistudio.google.com',
    },
  }
}

// ─── Orchestrator Integration ─────────────────────────────────────────────────
// For multi-provider parallel execution, use query-orchestrator.ts directly:
// import { queryOrchestrator } from './query-orchestrator'
// const result = await queryOrchestrator.orchestrateQuery(promptText, ['chatgpt', 'gemini', 'perplexity'])
