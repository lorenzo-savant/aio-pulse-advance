import { type NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requireUser, rateLimitGate } from '@/lib/api-auth'
import { journeyAnalyzeSchema, firstZodMessage } from '@/lib/validations'
import {
  analyzeJourney,
  calculateJourneyScore,
  trackBrandEmergence,
  getJourneyScoreBreakdown,
} from '@/lib/services/agentic-journey'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requireUser(request)
  if (auth instanceof NextResponse) return auth

  const limited = await rateLimitGate(request, 'journey-analyze', 20)
  if (limited) return limited

  try {
    const parsed = journeyAnalyzeSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 400 })
    }
    const { turns, brandDomain } = parsed.data

    const analysis = analyzeJourney(turns)
    const score = calculateJourneyScore(analysis)
    const breakdown = getJourneyScoreBreakdown(analysis)

    let brandEmergence = null
    if (brandDomain) {
      brandEmergence = trackBrandEmergence(turns, brandDomain)
    }

    return NextResponse.json({
      analysis,
      score,
      breakdown,
      brandEmergence,
    })
  } catch (error) {
    logger.error('Journey analysis error', { err: error })
    return NextResponse.json({ error: 'Failed to analyze journey' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Journey analysis API',
    methods: {
      POST: {
        description: 'Analyze multi-turn journey and calculate score',
        body: {
          turns: 'Array of {id, prompt, response?, timestamp}',
          brandDomain: 'Optional brand domain for emergence tracking',
        },
      },
    },
  })
}
