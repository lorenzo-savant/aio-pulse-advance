// PATH: src/lib/services/analysis.ts
// Unified analysis service — routes to the 4 core providers (OpenAI, Gemini, Perplexity, Anthropic).

import type { AnalysisResult, EngineId, AIProvider, ModelId } from '@/types'
import { generateId } from '@/lib/utils'
import { safeFetchText } from '@/lib/utils/safe-fetch'
import { buildAnalysisPrompt, callGemini } from './gemini'
import { callOpenAI } from './openai'
import { callPerplexity } from './perplexity'
import { callAnthropic } from './anthropic'
import { logger } from '@/lib/logger'

function repairTruncatedJson(raw: string): string {
  let s = raw.trim()
  const quoteCount = (s.match(/(?<!\\)"/g) || []).length
  if (quoteCount % 2 !== 0) s += '"'
  s = s.replace(/,\s*"[^"]*"\s*:\s*$/, '')
  s = s.replace(/,\s*"[^"]*"?\s*$/, '')
  s = s.replace(/,\s*$/, '')
  const stack: string[] = []
  let inString = false
  let escaped = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\' && inString) {
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === '{') stack.push('}')
    else if (ch === '[') stack.push(']')
    else if (ch === '}' || ch === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === ch) stack.pop()
    }
  }
  s = s.replace(/,\s*$/, '')
  while (stack.length > 0) s += stack.pop()
  return s
}

export const MODEL_PROVIDER_MAP: Record<ModelId, AIProvider> = {
  default: 'gemini',
  'gemini-flash': 'gemini',
  'gemini-pro': 'gemini',
  'gpt-4o-mini': 'openai',
  'gpt-4o': 'openai',
  'claude-sonnet': 'anthropic',
  'claude-haiku': 'anthropic',
  'perplexity-sonar': 'perplexity',
}

const MODEL_MAP: Record<ModelId, string> = {
  default: 'gemini-2.5-flash',
  'gemini-flash': 'gemini-2.5-flash',
  'gemini-pro': 'gemini-2.5-pro',
  'gpt-4o-mini': 'gpt-4o-mini',
  'gpt-4o': 'gpt-4o',
  'claude-sonnet': 'claude-sonnet-4-5',
  'claude-haiku': 'claude-haiku-4-5-20251001',
  'perplexity-sonar': 'sonar',
}

async function callAIProvider(
  prompt: string,
  provider: AIProvider,
  model: ModelId,
): Promise<string> {
  const modelId = MODEL_MAP[model] || 'gemini-2.5-flash'

  switch (provider) {
    case 'gemini':
      return callGemini(prompt)

    case 'openai':
      return callOpenAI(prompt, { model: modelId, temperature: 0.3 })

    case 'anthropic':
      return callAnthropic(prompt)

    case 'perplexity':
      return callPerplexity(prompt)

    default:
      return callGemini(prompt)
  }
}

export async function fetchUrlContent(url: string): Promise<string> {
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`
  const { text: html, response: res } = await safeFetchText(normalized, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
    },
    timeout: 45_000,
  })

  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`)
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000)

  if (text.length < 50) throw new Error('Page content too short or unreadable')
  return text
}

export async function analyzeWithProvider(
  input: string,
  mode: 'text' | 'url',
  engine: EngineId,
  source: string,
  provider: AIProvider,
  model: ModelId,
  brand?: {
    name: string
    industry?: string | null
    description?: string | null
    competitors?: string[] | null
  },
): Promise<AnalysisResult> {
  const contentToAnalyze = mode === 'url' ? await fetchUrlContent(input) : input

  const prompt = buildAnalysisPrompt(contentToAnalyze, engine, brand)
  const rawResponse = await callAIProvider(prompt, provider, model)

  const cleaned = rawResponse
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  let parsed: Omit<AnalysisResult, 'id' | 'source' | 'type' | 'analyzedText' | 'timestamp'>

  try {
    parsed = JSON.parse(cleaned) as typeof parsed
  } catch {
    try {
      const fixed = repairTruncatedJson(cleaned)
      parsed = JSON.parse(fixed) as typeof parsed
    } catch (e2) {
      logger.error('Failed to parse AI response', {
        service: 'analysis',
        rawPreview: cleaned.slice(0, 500),
      })
      throw new Error(
        `Failed to parse AI response: ${e2 instanceof Error ? e2.message : 'Invalid JSON'}. Please try again.`,
      )
    }
  }

  if (typeof parsed.visibilityScore !== 'number') {
    throw new Error('Invalid analysis response structure')
  }

  return {
    id: generateId('scan'),
    source,
    type: mode,
    analyzedText: contentToAnalyze.slice(0, 2000),
    timestamp: Date.now(),
    ...parsed,
    suggestions: parsed.suggestions ?? [],
    keywords: parsed.keywords ?? [],
    engineBreakdown: parsed.engineBreakdown ?? [],
    intentSignals: parsed.intentSignals ?? [],
    visibilityScore: Math.min(100, Math.max(0, parsed.visibilityScore)),
    intentConfidence: Math.min(100, Math.max(0, parsed.intentConfidence ?? 0)),
    contentTypeConfidence: Math.min(100, Math.max(0, parsed.contentTypeConfidence ?? 0)),
    toneConfidence: Math.min(100, Math.max(0, parsed.toneConfidence ?? 0)),
    intent: parsed.intent ?? 'Informational',
    contentType: parsed.contentType ?? 'Article',
    tone: parsed.tone ?? 'Professional',
    readingLevel: parsed.readingLevel ?? 'Undergraduate',
    audience: parsed.audience ?? 'General audience',
  }
}
