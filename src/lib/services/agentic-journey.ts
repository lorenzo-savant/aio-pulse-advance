export type JourneyStage = 'discovery' | 'research' | 'comparison' | 'decision'

export interface JourneyTurn {
  id: string
  prompt: string
  response?: string
  timestamp: number
}

export interface JourneyAnalysis {
  stages: JourneyStage[]
  currentStage: JourneyStage
  stageProgress: number
  brandMentions: string[]
  brandFirstMention: string | null
  brandFirstMentionStage: JourneyStage | null
  totalTurns: number
}

export interface StageEmergence {
  brand: string
  domain: string
  firstStage: JourneyStage
  emergenceScore: number
}

export interface JourneyScoreResult {
  score: number
  maxScore: number
  breakdown: {
    stageProgress: number
    brandMentioned: boolean
  }
}

const STAGE_PATTERNS = {
  discovery: /\b(what is|how does|what are|explain|best\s+\w+|find\s+\w+)\b/i,
  research: /\b(compare|vs|versus|differences?|between|learn\s+more|details?|information)\b/i,
  comparison:
    /\b(pros?\s*(and|&)\s*cons?|which\s+(?:is\s+)?better|advantages?|disadvantages?|review)\b/i,
  decision: /\b(should\s+I|buy|purchase|subscribe|recommend|order|get\s+now|pricing|price|cost)\b/i,
}

export function detectJourneyStage(prompt: string): JourneyStage {
  const stageOrder: JourneyStage[] = ['decision', 'comparison', 'research', 'discovery']

  for (const stage of stageOrder) {
    if (STAGE_PATTERNS[stage].test(prompt)) {
      return stage
    }
  }

  return 'discovery'
}

export function analyzeJourney(turns: JourneyTurn[]): JourneyAnalysis {
  if (turns.length === 0) {
    return {
      stages: [],
      currentStage: 'discovery',
      stageProgress: 0,
      brandMentions: [],
      brandFirstMention: null,
      brandFirstMentionStage: null,
      totalTurns: 0,
    }
  }

  const stages = turns.map((turn) => detectJourneyStage(turn.prompt))
  const currentStage = stages[stages.length - 1]!

  const stageOrder: JourneyStage[] = ['discovery', 'research', 'comparison', 'decision']
  const currentStageIndex = stageOrder.indexOf(currentStage)
  const stageProgress = ((currentStageIndex + 1) / 4) * 100

  const brandMentions = extractBrands(turns)
  const brandFirstMention = brandMentions[0] || null
  const brandFirstMentionStage = brandFirstMention
    ? (stages[
        turns.findIndex((t) => t.prompt.toLowerCase().includes(brandFirstMention.toLowerCase()))
      ] ?? 'discovery')
    : null

  return {
    stages,
    currentStage: currentStage,
    stageProgress,
    brandMentions,
    brandFirstMention,
    brandFirstMentionStage,
    totalTurns: turns.length,
  }
}

function extractBrands(turns: JourneyTurn[]): string[] {
  const brands = new Set<string>()
  const knownBrands = [
    'openai',
    'anthropic',
    'google',
    'gemini',
    'perplexity',
    'cohere',
    'mistral',
    'meta',
    'llama',
    'anthropic',
    'xai',
    'grok',
    'meta',
    'aws',
    'azure',
    'openrouter',
    'deepseek',
    'nvidia',
    'microsoft',
  ]

  for (const turn of turns) {
    const text = turn.prompt.toLowerCase()
    for (const brand of knownBrands) {
      if (text.includes(brand)) {
        brands.add(brand.charAt(0).toUpperCase() + brand.slice(1))
      }
    }
  }

  return Array.from(brands)
}

export function trackBrandEmergence(turns: JourneyTurn[], brandDomain: string): StageEmergence {
  const analysis = analyzeJourney(turns)

  const firstStage = analysis.brandFirstMentionStage || 'discovery'
  const stageOrder: JourneyStage[] = ['discovery', 'research', 'comparison', 'decision']
  const stageIndex = stageOrder.indexOf(firstStage)

  const emergenceScore = ((stageIndex + 1) / 4) * 100

  return {
    brand: brandDomain,
    domain: brandDomain,
    firstStage,
    emergenceScore: Math.round(emergenceScore),
  }
}

export function calculateJourneyScore(journeyAnalysis: JourneyAnalysis): number {
  const stageOrder: JourneyStage[] = ['discovery', 'research', 'comparison', 'decision']
  const currentStageIndex = stageOrder.indexOf(journeyAnalysis.currentStage)

  const stageScore = (currentStageIndex + 1) * 25
  const brandScore = journeyAnalysis.brandFirstMention ? 25 : 0

  const score = stageScore + brandScore

  return Math.min(100, Math.max(0, score))
}

export function getJourneyScoreBreakdown(journeyAnalysis: JourneyAnalysis): JourneyScoreResult {
  const score = calculateJourneyScore(journeyAnalysis)

  const stageOrder: JourneyStage[] = ['discovery', 'research', 'comparison', 'decision']
  const currentStageIndex = stageOrder.indexOf(journeyAnalysis.currentStage)
  const stageProgress = (currentStageIndex + 1) * 25

  return {
    score,
    maxScore: 100,
    breakdown: {
      stageProgress,
      brandMentioned: Boolean(journeyAnalysis.brandFirstMention),
    },
  }
}
