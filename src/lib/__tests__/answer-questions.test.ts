import { describe, it, expect } from 'vitest'
import {
  suggestQuestions,
  MAX_PILLAR_QUESTIONS,
  WEAK_PILLAR_SCORE,
} from '@/lib/agents/answer-questions'

/**
 * Which questions the answer panel offers.
 *
 * Deriving the list from the brand's own data is what keeps the panel from
 * asking things the rows cannot answer — a question that always ends in a
 * refusal teaches people to ignore the whole panel.
 */

const pillar = (key: string, score: number) => ({ key, score })

describe('suggestQuestions', () => {
  it('offers the delta question only when there are two snapshots to compare', () => {
    const withHistory = suggestQuestions([pillar('citation', 40)], true)
    const without = suggestQuestions([pillar('citation', 40)], false)

    expect(withHistory.some((q) => q.kind === 'delta')).toBe(true)
    expect(without.some((q) => q.kind === 'delta')).toBe(false)
  })

  it('leads with what changed, since it is the question people arrive with', () => {
    const questions = suggestQuestions([pillar('citation', 40)], true)
    expect(questions[0]?.kind).toBe('delta')
  })

  it('offers the weakest pillars first', () => {
    const questions = suggestQuestions(
      [pillar('citation', 55), pillar('position', 20), pillar('trust', 40)],
      false,
    )
    expect(questions.map((q) => q.pillar)).toEqual(['position', 'trust', 'citation'])
  })

  it('leaves healthy pillars alone', () => {
    const questions = suggestQuestions(
      [pillar('citation', 90), pillar('presence', 85), pillar('position', 30)],
      false,
    )
    // Explaining a score of 90 is rarely what anyone came here for.
    expect(questions.map((q) => q.pillar)).toEqual(['position'])
  })

  it('keeps the list a shortlist rather than a menu', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((k, i) => pillar(k, 10 + i))
    const questions = suggestQuestions(many, false)
    expect(questions).toHaveLength(MAX_PILLAR_QUESTIONS)
  })

  it('offers nothing when every pillar is healthy and there is no history', () => {
    // The panel hides itself in this case rather than inviting a question whose
    // only honest answer is "nothing is wrong".
    const questions = suggestQuestions([pillar('citation', WEAK_PILLAR_SCORE + 1)], false)
    expect(questions).toEqual([])
  })

  it('treats the threshold as exclusive, so a pillar exactly at it is healthy', () => {
    expect(suggestQuestions([pillar('citation', WEAK_PILLAR_SCORE)], false)).toEqual([])
    expect(suggestQuestions([pillar('citation', WEAK_PILLAR_SCORE - 1)], false)).toHaveLength(1)
  })

  it('carries the score so the question can name the number it is about', () => {
    const [question] = suggestQuestions([pillar('position', 31)], false)
    expect(question).toMatchObject({ kind: 'attribution', pillar: 'position', score: 31 })
  })

  it('does not mutate the caller’s pillar array while sorting', () => {
    const pillars = [pillar('citation', 55), pillar('position', 20)]
    suggestQuestions(pillars, false)
    expect(pillars.map((p) => p.key)).toEqual(['citation', 'position'])
  })
})
