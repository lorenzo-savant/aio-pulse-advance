// PATH: src/lib/services/market-position.ts
//
// Market Position — a qualitative competitive classification inspired by
// HubSpot's AEO "Market Competition" dimension, but derived ENTIRELY from this
// product's REAL signals (Share of Voice rank/momentum + measured sentiment),
// never invented. The `reasoning` string always states the numbers behind the
// label, so the classification is transparent rather than a black box.
//
// Pure + deterministic → unit-tested directly.

import { sampleConfidence } from './confidence'

export type CategoryRole = 'leader' | 'challenger' | 'niche'
export type InnovationPerception = 'innovator' | 'disruptor' | 'traditionalist'

export interface MarketPositionInput {
  /** Brand Share of Voice, 0–100. */
  share: number
  /** 1-based rank by share among all detected entities (1 = top). */
  rank: number
  /** Number of entities detected (brand + competitors). */
  entityCount: number
  /** Brand SOV change over the window in percentage points (recent − older). */
  momentum: number
  /** Average sentiment toward the brand, −1..1. */
  avgSentiment: number
  /** Responses analyzed — drives the confidence caveat. */
  totalResponses: number
}

export interface MarketPosition {
  categoryRole: CategoryRole
  innovationPerception: InnovationPerception
  reasoning: string
  confidence: 'low' | 'medium' | 'high'
}

const ROLE_THRESHOLDS = { leaderShare: 25, challengerShare: 8, challengerRank: 3 }
const INNOV = { strongMomentum: 8, mildMomentum: 3, positiveSentiment: 0.3 }

function classifyRole(input: MarketPositionInput): CategoryRole {
  const { share, rank, entityCount } = input
  // No competitors detected: top by default, but flagged as low-signal in the
  // reasoning/confidence rather than overclaiming "Leader of the category".
  if (entityCount <= 1) return share > 0 ? 'leader' : 'niche'
  if (rank === 1 && share >= ROLE_THRESHOLDS.leaderShare) return 'leader'
  if (rank <= ROLE_THRESHOLDS.challengerRank && share >= ROLE_THRESHOLDS.challengerShare) {
    return 'challenger'
  }
  return 'niche'
}

function classifyInnovation(input: MarketPositionInput): InnovationPerception {
  const { momentum, avgSentiment } = input
  // Momentum (gaining share) is the clearest "disruption" signal; strong
  // positive characterization reads as "innovator"; otherwise established/flat.
  if (momentum >= INNOV.strongMomentum) return 'disruptor'
  if (avgSentiment >= INNOV.positiveSentiment) return 'innovator'
  if (momentum >= INNOV.mildMomentum) return 'disruptor'
  return 'traditionalist'
}

const ROLE_BLURB: Record<CategoryRole, string> = {
  leader: 'leads its category in AI answers',
  challenger: 'is a strong challenger in its category',
  niche: 'holds a niche position in its category',
}
const INNOV_BLURB: Record<InnovationPerception, string> = {
  innovator: 'characterized as an innovator',
  disruptor: 'gaining ground as a disruptor',
  traditionalist: 'seen as an established traditionalist',
}

function fmtSigned(n: number): string {
  const r = Math.round(n * 10) / 10
  return r > 0 ? `+${r}` : `${r}`
}

export function classifyMarketPosition(input: MarketPositionInput): MarketPosition {
  const categoryRole = classifyRole(input)
  const innovationPerception = classifyInnovation(input)

  const confidence: MarketPosition['confidence'] = sampleConfidence(input.totalResponses)

  const parts: string[] = [
    `${ROLE_BLURB[categoryRole]} (${Math.round(input.share)}% share of voice, rank #${input.rank} of ${input.entityCount})`,
    `${INNOV_BLURB[innovationPerception]} — sentiment ${fmtSigned(input.avgSentiment)}, share momentum ${fmtSigned(input.momentum)}pp`,
  ]
  if (input.entityCount <= 1) {
    parts.push('no competitors detected yet, so the category role is low-signal')
  }
  if (confidence === 'low') {
    parts.push(`based on only ${input.totalResponses} responses — treat as provisional`)
  }

  return {
    categoryRole,
    innovationPerception,
    reasoning: parts.join('; ') + '.',
    confidence,
  }
}
