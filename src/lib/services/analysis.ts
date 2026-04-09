// PATH: src/lib/services/analysis.ts
// Unified analysis service that routes to different AI providers

import type { AnalysisResult, EngineId, AIProvider, ModelId } from '@/types'
import { generateId } from '@/lib/utils'
import { buildAnalysisPrompt, callGemini } from './gemini'
import { callGroq, GROQ_MODELS } from './groq'
import { callCerebras, CEREBRAS_MODELS } from './cerebras'
import { callOpenRouter, OPENROUTER_MODELS } from './openrouter'

// ─── Truncated JSON Repair (shared logic) ────────────────────────────────────

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

const MODEL_PROVIDER_MAP: Record<ModelId, AIProvider> = {
  default: 'gemini',
  'gemini-flash': 'gemini',
  'gpt-4o-mini': 'openrouter',
  'gpt-4o': 'openrouter',
  'claude-sonnet': 'openrouter',
  'llama-70b': 'groq',
  'mixtral-8x7b': 'groq',
  'llama-cerebras': 'cerebras',
}

const MODEL_MAP: Record<ModelId, string> = {
  default: 'gemini-2.5-flash',
  'gemini-flash': 'gemini-2.5-flash',
  'gpt-4o-mini': OPENROUTER_MODELS.GPT4O_MINI,
  'gpt-4o': OPENROUTER_MODELS.GPT4O,
  'claude-sonnet': OPENROUTER_MODELS.CLAUDE_SONNET,
  'llama-70b': GROQ_MODELS.LLAMA_70B,
  'mixtral-8x7b': GROQ_MODELS.MIXTRAL,
  'llama-cerebras': CEREBRAS_MODELS.LLAMA_8B,
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

    case 'openrouter':
      return callOpenRouter(prompt, {
        model: modelId,
        temperature: 0.3,
      })

    case 'groq':
      return callGroq(prompt, {
        model: modelId as typeof GROQ_MODELS.LLAMA_70B,
        temperature: 0.3,
      })

    case 'cerebras':
      return callCerebras(prompt, {
        model: modelId as typeof CEREBRAS_MODELS.LLAMA_70B,
        temperature: 0.3,
        maxTokens: 2048,
      })

    default:
      return callGemini(prompt)
  }
}

export async function fetchUrlContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AIOPulseBot/1.0; +https://aio-pulse.com/bot)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`)

  const html = await res.text()
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
): Promise<AnalysisResult> {
  const contentToAnalyze = mode === 'url' ? await fetchUrlContent(input) : input

  const prompt = buildAnalysisPrompt(contentToAnalyze, engine)
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
      console.error('Failed to parse AI response:', cleaned.slice(0, 500))
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
