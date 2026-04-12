// PATH: src/lib/services/ai-router.ts
// AI Router — routes engine simulation and brand analysis to the 4 core providers.
// Core providers: ChatGPT (OpenAI), Gemini (Google), Perplexity, Claude (Anthropic).

import type { MonitoringEngine } from '@/types'
import { isOpenAIAvailable, callOpenAI } from './openai'
import { isPerplexityAvailable, callPerplexity } from './perplexity'
import { isAnthropicAvailable, callAnthropic } from './anthropic'
import { logger } from '@/lib/logger'

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

function isGeminiAvailable(): boolean {
  return Boolean(process.env['GEMINI_API_KEY'])
}

// ─── simulateEngineResponse ────────────────────────────────────────────────────
// Calls the real API for the requested engine. Falls back to Gemini if that
// engine's provider is not configured or fails.

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

  if (engine === 'chatgpt' && isOpenAIAvailable()) {
    try {
      const text = await callOpenAI(fullPrompt)
      return { text, provider: 'openai:gpt-4o-mini' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`OpenAI: ${msg}`)
      logger.warn('OpenAI call failed', { service: 'ai-router', engine, error: msg })
    }
  }

  if (engine === 'gemini' && isGeminiAvailable()) {
    try {
      const text = await callGeminiFallback(fullPrompt)
      return { text, provider: 'gemini:flash-2.0' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`Gemini: ${msg}`)
      logger.warn('Gemini call failed', { service: 'ai-router', engine, error: msg })
    }
  }

  if (engine === 'perplexity' && isPerplexityAvailable()) {
    try {
      const text = await callPerplexity(fullPrompt)
      return { text, provider: 'perplexity:sonar' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`Perplexity: ${msg}`)
      logger.warn('Perplexity call failed', { service: 'ai-router', engine, error: msg })
    }
  }

  if (engine === 'claude' && isAnthropicAvailable()) {
    try {
      const text = await callAnthropic(fullPrompt)
      return { text, provider: 'anthropic:claude-sonnet' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`Anthropic: ${msg}`)
      logger.warn('Anthropic call failed', { service: 'ai-router', engine, error: msg })
    }
  }

  // Final fallback: Gemini (cheapest, most widely configured)
  if (isGeminiAvailable()) {
    try {
      const text = await callGeminiFallback(fullPrompt)
      return { text, provider: 'gemini:flash-2.0' }
    } catch (e) {
      errors.push(`Gemini fallback: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  throw new Error(
    `Tutti i provider AI hanno fallito per la simulazione di "${engine}":\n` +
      errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n'),
  )
}

// ─── analyzeResponseForBrand ──────────────────────────────────────────────────
// Analyzes a response for brand metrics. Uses Gemini as primary (cheapest
// reasoning), falls back to Claude and ChatGPT.

export async function analyzeResponseForBrand(
  analysisPrompt: string,
): Promise<{ text: string; provider: string }> {
  const errors: string[] = []

  if (isGeminiAvailable()) {
    try {
      const text = await callGeminiFallback(analysisPrompt)
      return { text, provider: 'gemini:flash-2.0' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`Gemini: ${msg}`)
      logger.warn('Gemini failed for analysis', { service: 'ai-router', error: msg })
    }
  }

  if (isAnthropicAvailable()) {
    try {
      const text = await callAnthropic(analysisPrompt)
      return { text, provider: 'anthropic:claude-sonnet' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`Anthropic: ${msg}`)
      logger.warn('Anthropic failed for analysis', { service: 'ai-router', error: msg })
    }
  }

  if (isOpenAIAvailable()) {
    try {
      const text = await callOpenAI(analysisPrompt)
      return { text, provider: 'openai:gpt-4o-mini' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`OpenAI: ${msg}`)
      logger.warn('OpenAI failed for analysis', { service: 'ai-router', error: msg })
    }
  }

  throw new Error(
    "Tutti i provider AI hanno fallito per l'analisi brand:\n" +
      errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n'),
  )
}

// ─── getProviderStatus ────────────────────────────────────────────────────────

export function getProviderStatus() {
  return {
    chatgpt: {
      configured: isOpenAIAvailable(),
      bestFor: 'Simulazione ChatGPT / SearchGPT',
      signupUrl: 'https://platform.openai.com',
    },
    gemini: {
      configured: isGeminiAvailable(),
      bestFor: 'Simulazione Gemini + analisi brand (fallback primario)',
      signupUrl: 'https://aistudio.google.com',
    },
    perplexity: {
      configured: isPerplexityAvailable(),
      bestFor: 'Simulazione Perplexity con citazioni',
      signupUrl: 'https://www.perplexity.ai/settings/api',
    },
    claude: {
      configured: isAnthropicAvailable(),
      bestFor: 'Simulazione Claude + analisi ragionata',
      signupUrl: 'https://console.anthropic.com',
    },
  }
}
