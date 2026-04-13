import { describe, it, expect } from 'vitest'
import {
  detectJourneyStage,
  analyzeJourney,
  trackBrandEmergence,
  calculateJourneyScore,
  getJourneyScoreBreakdown,
} from '../services/agentic-journey'

describe('detectJourneyStage', () => {
  it('detects discovery stage - what is', () => {
    expect(detectJourneyStage('What is ChatGPT?')).toBe('discovery')
  })

  it('detects discovery stage - how does', () => {
    expect(detectJourneyStage('How does GPT-4 work?')).toBe('discovery')
  })

  it('detects discovery stage - best', () => {
    expect(detectJourneyStage('What is the best AI model?')).toBe('discovery')
  })

  it('detects research stage - compare', () => {
    expect(detectJourneyStage('Compare GPT-4 vs Claude')).toBe('research')
  })

  it('detects research stage - vs', () => {
    expect(detectJourneyStage('OpenAI vs Anthropic')).toBe('research')
  })

  it('detects research stage - differences', () => {
    expect(detectJourneyStage('What are the differences between them?')).toBe('research')
  })

  it('detects comparison stage - pros cons', () => {
    expect(detectJourneyStage('What are the pros and cons of GPT-4?')).toBe('comparison')
  })

  it('detects comparison stage - which better', () => {
    expect(detectJourneyStage('Which is better for coding?')).toBe('comparison')
  })

  it('detects decision stage - buy', () => {
    expect(detectJourneyStage('Should I buy ChatGPT Plus?')).toBe('decision')
  })

  it('detects decision stage - subscribe', () => {
    expect(detectJourneyStage('How to subscribe to Claude?')).toBe('decision')
  })

  it('detects decision stage - pricing', () => {
    expect(detectJourneyStage('What is the pricing for GPT-4?')).toBe('decision')
  })

  it('defaults to discovery for unknown patterns', () => {
    expect(detectJourneyStage('Hello world')).toBe('discovery')
  })
})

describe('analyzeJourney', () => {
  it('returns empty analysis for empty turns', () => {
    const result = analyzeJourney([])
    expect(result.stages).toEqual([])
    expect(result.currentStage).toBe('discovery')
    expect(result.totalTurns).toBe(0)
  })

  it('analyzes multi-turn journey correctly', () => {
    const turns = [
      { id: '1', prompt: 'What is ChatGPT?', timestamp: 1000 },
      { id: '2', prompt: 'Compare GPT-4 vs Claude', timestamp: 2000 },
      { id: '3', prompt: 'What are the pros and cons?', timestamp: 3000 },
      { id: '4', prompt: 'Should I subscribe to ChatGPT Plus?', timestamp: 4000 },
    ]

    const result = analyzeJourney(turns)
    expect(result.stages).toEqual(['discovery', 'research', 'comparison', 'decision'])
    expect(result.currentStage).toBe('decision')
    expect(result.totalTurns).toBe(4)
    expect(result.stageProgress).toBe(100)
  })

  it('extracts brand mentions', () => {
    const turns = [
      { id: '1', prompt: 'What is OpenAI?', timestamp: 1000 },
      { id: '2', prompt: 'Tell me about Claude from Anthropic', timestamp: 2000 },
    ]

    const result = analyzeJourney(turns)
    expect(result.brandMentions).toContain('Openai')
    expect(result.brandMentions).toContain('Anthropic')
    expect(result.brandFirstMention).toBe('Openai')
  })
})

describe('trackBrandEmergence', () => {
  it('tracks brand emergence correctly', () => {
    const turns = [
      { id: '1', prompt: 'What is OpenAI?', timestamp: 1000 },
      { id: '2', prompt: 'Compare with Anthropic', timestamp: 2000 },
    ]

    const result = trackBrandEmergence(turns, 'openai')
    expect(result.brand).toBe('openai')
    expect(result.firstStage).toBe('discovery')
    expect(result.emergenceScore).toBe(25)
  })

  it('tracks brand emergence in later stage', () => {
    const turns = [
      { id: '1', prompt: 'What is AI?', timestamp: 1000 },
      { id: '2', prompt: 'Compare OpenAI vs Claude', timestamp: 2000 },
      { id: '3', prompt: 'Should I subscribe to OpenAI?', timestamp: 3000 },
    ]

    const result = trackBrandEmergence(turns, 'openai')
    expect(result.firstStage).toBe('research')
    expect(result.emergenceScore).toBe(50)
  })
})

describe('calculateJourneyScore', () => {
  it('calculates score for early stage without brand', () => {
    const turns = [{ id: '1', prompt: 'What is AI?', timestamp: 1000 }]
    const analysis = analyzeJourney(turns)

    const score = calculateJourneyScore(analysis)
    expect(score).toBe(25)
  })

  it('calculates score with brand mention', () => {
    const analysis = analyzeJourney([{ id: '1', prompt: 'What is OpenAI?', timestamp: 1000 }])

    const score = calculateJourneyScore(analysis)
    expect(score).toBe(50)
  })

  it('calculates max score for decision stage with brand', () => {
    const analysis = analyzeJourney([
      { id: '1', prompt: 'What is OpenAI?', timestamp: 1000 },
      { id: '2', prompt: 'Compare GPT vs Claude', timestamp: 2000 },
      { id: '3', prompt: 'Pros and cons?', timestamp: 3000 },
      { id: '4', prompt: 'Should I buy ChatGPT Plus?', timestamp: 4000 },
    ])

    const score = calculateJourneyScore(analysis)
    expect(score).toBe(100)
  })
})

describe('getJourneyScoreBreakdown', () => {
  it('returns score breakdown', () => {
    const analysis = analyzeJourney([{ id: '1', prompt: 'What is OpenAI?', timestamp: 1000 }])

    const result = getJourneyScoreBreakdown(analysis)
    expect(result.score).toBe(50)
    expect(result.maxScore).toBe(100)
    expect(result.breakdown.stageProgress).toBe(25)
    expect(result.breakdown.brandMentioned).toBe(true)
  })
})
