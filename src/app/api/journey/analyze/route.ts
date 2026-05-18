import { type NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requireUser, rateLimitGate } from '@/lib/api-auth'
import {
  analyzeJourney,
  calculateJourneyScore,
  trackBrandEmergence,
  getJourneyScoreBreakdown,
} from '@/lib/services/agentic-journey'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_TURNS = 50
const MAX_PROMPT_LEN = 8000

interface JourneyTurn {
  id: string
  prompt: string
  response?: string
  timestamp: number
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request)
  if (auth instanceof NextResponse) return auth

  const limited = await rateLimitGate(request, 'journey-analyze', 20)
  if (limited) return limited

  try {
    const body = await request.json()
    const turns: JourneyTurn[] = body.turns

    if (!Array.isArray(turns) || turns.length === 0) {
      return NextResponse.json(
        { error: 'turns array is required and must not be empty' },
        { status: 400 },
      )
    }

    if (turns.length > MAX_TURNS) {
      return NextResponse.json(
        { error: `Too many turns (max ${MAX_TURNS})` },
        { status: 400 },
      )
    }

    for (const turn of turns) {
      if (!turn.prompt || typeof turn.prompt !== 'string') {
        return NextResponse.json({ error: 'Each turn must have a prompt string' }, { status: 400 })
      }
      if (turn.prompt.length > MAX_PROMPT_LEN) {
        return NextResponse.json(
          { error: `Turn prompt too long (max ${MAX_PROMPT_LEN} chars)` },
          { status: 400 },
        )
      }
    }

    const analysis = analyzeJourney(turns)
    const score = calculateJourneyScore(analysis)
    const breakdown = getJourneyScoreBreakdown(analysis)

    const brandDomain = body.brandDomain
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
