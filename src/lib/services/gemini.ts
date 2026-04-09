import type { AnalysisResult, EngineId, IntentType } from '@/types'
import { generateId } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeminiPart {
  text: string
}

interface GeminiContent {
  parts: GeminiPart[]
  role?: string
}

interface GeminiCandidate {
  content: GeminiContent
  finishReason: string
}

interface GeminiResponse {
  candidates: GeminiCandidate[]
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

export function buildAnalysisPrompt(content: string, engine: EngineId): string {
  const engineContext: Record<EngineId, string> = {
    all: 'all major AI search engines (ChatGPT, Gemini, Perplexity, Claude)',
    chatgpt: 'ChatGPT / SearchGPT (OpenAI)',
    gemini: 'Google Gemini / SGE (Google AI Overview)',
    perplexity: 'Perplexity AI (fact-density, citation-readiness)',
    claude: 'Anthropic Claude (logical depth, chain-of-thought quality)',
  }

  return `You are an expert in AIO (AI Optimization), AEO (Answer Engine Optimization), and GEO (Generative Engine Optimization). Analyze the following content for visibility and citation potential in ${engineContext[engine]}.

CONTENT TO ANALYZE:
"""
${content.slice(0, 8000)}
"""

Respond ONLY with a valid JSON object matching this exact schema (no markdown, no explanation):
{
  "summary": "2-3 sentence executive summary of the content's AIO readiness",
  "visibilityScore": <number 0-100>,
  "engineBreakdown": [
    { "engine": "ChatGPT", "score": <0-100>, "status": <"optimal"|"needs-work"|"critical">, "details": "<specific insight>" },
    { "engine": "Gemini", "score": <0-100>, "status": <"optimal"|"needs-work"|"critical">, "details": "<specific insight>" },
    { "engine": "Perplexity", "score": <0-100>, "status": <"optimal"|"needs-work"|"critical">, "details": "<specific insight>" },
    { "engine": "Claude", "score": <0-100>, "status": <"optimal"|"needs-work"|"critical">, "details": "<specific insight>" }
  ],
  "suggestions": [
    "<actionable improvement #1>",
    "<actionable improvement #2>",
    "<actionable improvement #3>",
    "<actionable improvement #4>",
    "<actionable improvement #5>"
  ],
  "keywords": [
    { "word": "<keyword phrase>", "impact": <0-100>, "difficulty": <0-100> },
    { "word": "<keyword phrase>", "impact": <0-100>, "difficulty": <0-100> },
    { "word": "<keyword phrase>", "impact": <0-100>, "difficulty": <0-100> },
    { "word": "<keyword phrase>", "impact": <0-100>, "difficulty": <0-100> },
    { "word": "<keyword phrase>", "impact": <0-100>, "difficulty": <0-100> }
  ],
  "intent": <"Informational"|"Navigational"|"Transactional"|"Commercial"|"Mixed">,
  "intentConfidence": <0-100>,
  "intentSignals": ["<signal1>", "<signal2>", "<signal3>"],
  "contentType": "<Article|Guide|Product Page|Landing Page|Blog Post|Documentation|News|Other>",
  "contentTypeConfidence": <0-100>,
  "tone": "<Professional|Casual|Technical|Academic|Conversational|Persuasive>",
  "toneConfidence": <0-100>,
  "readingLevel": "<Elementary|Middle School|High School|Undergraduate|Graduate|Expert>",
  "audience": "<target audience description>"
}`
}

// ─── Core Gemini Caller ───────────────────────────────────────────────────────

export async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env['GEMINI_API_KEY']
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${err}`)
  }

  const data = (await res.json()) as GeminiResponse
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty response from Gemini')
  return text
}

// ─── URL Fetcher ──────────────────────────────────────────────────────────────

export async function fetchUrlContent(url: string): Promise<string> {
  let hostname = ''
  try {
    hostname = new URL(url).hostname
  } catch {
    hostname = url
  }

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    if (res.status === 403) {
      throw new Error(`Access denied (403) - ${hostname} is blocking automated requests.`)
    }
    if (res.status === 404) {
      throw new Error(`Page not found (404) - ${hostname}`)
    }
    throw new Error(`Failed to fetch ${hostname}: ${res.status}`)
  }

  const html = await res.text()

  // Strip HTML tags and scripts, extract readable text
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

// ─── Truncated JSON Repair ────────────────────────────────────────────────────
// Gemini sometimes truncates output mid-JSON. This function closes all open
// brackets/braces, removes trailing incomplete key-value pairs, and produces
// parseable JSON even from heavily truncated responses.

function repairTruncatedJson(raw: string): string {
  let s = raw.trim()

  // 1. Remove trailing incomplete string (unmatched quote)
  //    Count quotes — if odd, the last one is unclosed
  const quoteCount = (s.match(/(?<!\\)"/g) || []).length
  if (quoteCount % 2 !== 0) {
    // Close the dangling string
    s += '"'
  }

  // 2. Remove trailing incomplete key-value patterns
  //    e.g. `"key":` or `"key": "val` or `"key": 4` followed by nothing
  s = s.replace(/,\s*"[^"]*"\s*:\s*$/, '')        // "key":  (no value)
  s = s.replace(/,\s*"[^"]*"?\s*$/, '')            // trailing orphan key
  s = s.replace(/,\s*$/, '')                        // trailing comma

  // 3. Close all open brackets and braces
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
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop()
      }
    }
  }

  // Remove any trailing comma before we close
  s = s.replace(/,\s*$/, '')

  // Close everything that's still open (in reverse order)
  while (stack.length > 0) {
    s += stack.pop()
  }

  return s
}

// ─── Main Analyzer ────────────────────────────────────────────────────────────

export async function analyzeContent(
  input: string,
  mode: 'text' | 'url',
  engine: EngineId,
  source: string,
): Promise<AnalysisResult> {
  // If URL mode, fetch content first
  const contentToAnalyze = mode === 'url' ? await fetchUrlContent(input) : input

  const prompt = buildAnalysisPrompt(contentToAnalyze, engine)
  const rawResponse = await callGemini(prompt)

  // Debug: log raw response (first 200 chars)
  console.log('Raw Gemini response:', rawResponse.slice(0, 200))

  // Clean and parse JSON - handle multiple formats
  let cleaned = rawResponse
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  // If response still has markdown code blocks, try to extract JSON
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleaned = jsonMatch[0]
    }
  }

  let parsed: Omit<AnalysisResult, 'id' | 'source' | 'type' | 'analyzedText' | 'timestamp'>

  try {
    parsed = JSON.parse(cleaned) as typeof parsed
  } catch {
    // Robust truncated-JSON repair
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

  // Validate required fields
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
    // Ensure arrays
    suggestions: parsed.suggestions ?? [],
    keywords: parsed.keywords ?? [],
    engineBreakdown: parsed.engineBreakdown ?? [],
    intentSignals: parsed.intentSignals ?? [],
    // Clamp scores
    visibilityScore: Math.min(100, Math.max(0, parsed.visibilityScore)),
    intentConfidence: Math.min(100, Math.max(0, parsed.intentConfidence ?? 0)),
    contentTypeConfidence: Math.min(100, Math.max(0, parsed.contentTypeConfidence ?? 0)),
    toneConfidence: Math.min(100, Math.max(0, parsed.toneConfidence ?? 0)),
    // Defaults
    intent: (parsed.intent as IntentType) ?? 'Informational',
    contentType: parsed.contentType ?? 'Article',
    tone: parsed.tone ?? 'Professional',
    readingLevel: parsed.readingLevel ?? 'Undergraduate',
    audience: parsed.audience ?? 'General audience',
  }
}

// ─── Competitor Analyzer ──────────────────────────────────────────────────────

export interface CompetitorResult {
  url: string
  score: number
  summary: string
  keywords: Array<{ word: string; impact: number; difficulty: number }>
  engineBreakdown: Array<{ engine: string; score: number; status: string; details: string }>
  suggestions: string[]
}

export async function analyzeCompetitor(url: string): Promise<CompetitorResult> {
  const content = await fetchUrlContent(url)
  const result = await analyzeContent(content, 'text', 'all', url)
  return {
    url,
    score: result.visibilityScore,
    summary: result.summary,
    keywords: result.keywords,
    engineBreakdown: result.engineBreakdown,
    suggestions: result.suggestions,
  }
}

// ─── Engine Health Check ──────────────────────────────────────────────────────

const ENGINE_SIGNALS: Record<string, string[]> = {
  chatgpt: [
    'Define key terms clearly in the first paragraph',
    'Use numbered lists for step-by-step content',
    'Include concrete examples with measurable outcomes',
    'Add FAQ sections with question-answer format',
    'Cite authoritative sources explicitly',
  ],
  gemini: [
    'Optimize for Knowledge Graph entity recognition',
    'Use structured data / schema markup',
    'Include geographic and temporal signals',
    'Improve E-E-A-T signals (author bio, credentials)',
    'Add clear topic headings that match search queries',
  ],
  perplexity: [
    'Increase factual density with statistics and data',
    'Add publication dates and source attribution',
    'Use direct, declarative sentence structures',
    'Include numerical data and comparative metrics',
    'Add primary source links and citations',
  ],
  claude: [
    'Develop logical argument chains with clear reasoning',
    'Acknowledge nuance, counterarguments, and edge cases',
    'Use precise technical language appropriate to context',
    'Structure content with clear conceptual hierarchy',
    'Include comparative analysis and synthesis',
  ],
}

export function getEngineSignals(engineId: string): string[] {
  return ENGINE_SIGNALS[engineId.toLowerCase()] ?? []
}
