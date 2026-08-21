/**
 * Chooses which questions to offer about a brand's GEO score.
 *
 * Kept apart from `grounding.ts` so the UI can import it: that module opens a
 * server database client, which has no business in a browser bundle.
 *
 * The point of deriving the list from the data rather than hard-coding it is
 * that the panel can then only ask things the rows can answer — and it doubles
 * as the cheapest test of whether free-form conversation is needed at all. If
 * nobody ever wants more than these, it was not.
 */

/** Below this a pillar is worth explaining; above it, rarely what anyone asks. */
export const WEAK_PILLAR_SCORE = 70

/** More than this stops being a shortlist and becomes a menu. */
export const MAX_PILLAR_QUESTIONS = 3

export interface SuggestedQuestion {
  /** Stable id for React keys and for tracking which one was asked. */
  id: string
  kind: 'delta' | 'attribution'
  /** Present for attribution questions only. */
  pillar?: string
  /** The score being explained, for the question label. */
  score?: number
}

export function suggestQuestions(
  pillars: Array<{ key: string; score: number }>,
  hasHistory: boolean,
): SuggestedQuestion[] {
  const questions: SuggestedQuestion[] = []

  // "What changed" needs two snapshots to compare. Offering it with one would
  // produce a refusal every time, which teaches people to ignore the panel.
  if (hasHistory) questions.push({ id: 'delta', kind: 'delta' })

  const weakest = pillars
    .filter((p) => p.score < WEAK_PILLAR_SCORE)
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_PILLAR_QUESTIONS)

  for (const pillar of weakest) {
    questions.push({
      id: pillar.key,
      kind: 'attribution',
      pillar: pillar.key,
      score: pillar.score,
    })
  }

  return questions
}
