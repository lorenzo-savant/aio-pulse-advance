import { NextRequest, NextResponse } from 'next/server'
import { isOpenAIAvailable, callOpenAI } from '@/lib/services/openai'
import { isPerplexityAvailable, callPerplexity } from '@/lib/services/perplexity'
import { isAnthropicAvailable, callAnthropic } from '@/lib/services/anthropic'
import { isOpenRouterAvailable, callOpenRouterForEngine } from '@/lib/services/openrouter'
import { isGroqAvailable, callGroq } from '@/lib/services/groq'
import { isCerebrasAvailable, callCerebras } from '@/lib/services/cerebras'
import { callGemini } from '@/lib/services/gemini'
import { getCurrentUserId, AuthError } from '@/lib/supabase'

const TEST_PROMPT = 'What is AI? Answer in 2 sentences.'

export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 401 })
  }
  const results: Record<
    string,
    { status: string; error?: string; response?: string; latency?: number }
  > = {}

  const testProvider = async (
    name: string,
    fn: () => Promise<string>,
    isAvailable: () => boolean,
  ) => {
    const start = Date.now()
    try {
      if (!isAvailable()) {
        results[name] = { status: 'not_configured' }
        return
      }
      const response = await fn()
      results[name] = {
        status: 'ok',
        response: response.slice(0, 100) + '...',
        latency: Date.now() - start,
      }
    } catch (error) {
      results[name] = {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        latency: Date.now() - start,
      }
    }
  }

  await Promise.all([
    testProvider('chatgpt', async () => callOpenAI(TEST_PROMPT), isOpenAIAvailable),
    testProvider(
      'gemini',
      async () => callGemini(TEST_PROMPT),
      () => Boolean(process.env.GEMINI_API_KEY),
    ),
    testProvider('perplexity', async () => callPerplexity(TEST_PROMPT), isPerplexityAvailable),
    testProvider('claude', async () => callAnthropic(TEST_PROMPT), isAnthropicAvailable),
    testProvider(
      'openrouter',
      async () => callOpenRouterForEngine(TEST_PROMPT, 'chatgpt'),
      isOpenRouterAvailable,
    ),
    testProvider('groq', async () => callGroq(TEST_PROMPT), isGroqAvailable),
    testProvider('cerebras', async () => callCerebras(TEST_PROMPT), isCerebrasAvailable),
  ])

  return NextResponse.json({
    success: true,
    results,
    timestamp: Date.now(),
  })
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'POST to test AI providers',
    providers: ['chatgpt', 'gemini', 'perplexity', 'claude', 'openrouter', 'groq', 'cerebras'],
  })
}
