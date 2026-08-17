import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isOpenAIAvailable, callOpenAI } from '@/lib/services/openai'
import { isPerplexityAvailable, callPerplexity } from '@/lib/services/perplexity'
import { callGemini } from '@/lib/services/gemini'
import { requireUser } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/ratelimit'
import { logger } from '@/lib/logger'
import { ACTIVE_ENGINES } from '@/types'

const TEST_PROMPT = 'What is AI? Answer in 2 sentences.'

// ─── POST /api/providers — live connectivity probe against the active engines ───────
// Each invocation spends one paid provider call per active engine, so on top of auth it carries
// a tight per-user limit. Raw provider error strings can leak account/quota
// detail — they are logged server-side and replaced with a generic label.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const rl = await checkRateLimit(`providers-test:${userId}`, 3, 60_000)
  if (!rl.success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    )
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
      logger.warn('Provider test failed', {
        source: 'providers',
        provider: name,
        error: error instanceof Error ? error.message : String(error),
      })
      results[name] = {
        status: 'error',
        error: 'Provider request failed — see server logs',
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
    providers: [...ACTIVE_ENGINES],
  })
}
