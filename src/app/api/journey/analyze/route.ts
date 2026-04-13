import { NextResponse } from 'next/server'
import {
  analyzeJourney,
  calculateJourneyScore,
  trackBrandEmergence,
  getJourneyScoreBreakdown,
} from '@/lib/services/agentic-journey'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

interface JourneyTurn {
  id: string
  prompt: string
  response?: string
  timestamp: number
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const turns: JourneyTurn[] = body.turns

    if (!Array.isArray(turns) || turns.length === 0) {
      return NextResponse.json(
        { error: 'turns array is required and must not be empty' },
        { status: 400 },
      )
    }

    for (const turn of turns) {
      if (!turn.prompt || typeof turn.prompt !== 'string') {
        return NextResponse.json({ error: 'Each turn must have a prompt string' }, { status: 400 })
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
    console.error('Journey analysis error:', error)
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
