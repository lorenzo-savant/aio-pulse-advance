import { describe, it, expect } from 'vitest'
import { planTopicCluster } from '@/lib/utils/topic-cluster'

const SUBQS = [
  'What features matter most for actors on a casting platform?',
  'How do casting platforms charge actors for features?',
  'Which features do productions value on a casting platform?',
  'How are auditions scheduled on casting platforms?',
  'How do auditions work for self-tapes?',
  'What is the difference between an audition and a callback?',
  'How is sentiment about casting platforms in Sweden?',
]

describe('planTopicCluster', () => {
  it('builds a pillar with totalQuestions matching the input', () => {
    const plan = planTopicCluster('Casting platforms', SUBQS)
    expect(plan.pillar.topic).toBe('Casting platforms')
    expect(plan.pillar.totalQuestions).toBe(SUBQS.length)
    expect(plan.pillar.coverage).toBeNull() // no html → null
    expect(plan.pillar.verdict).toBe('unknown')
  })

  it('groups questions under the most-frequent shared content term', () => {
    const plan = planTopicCluster('Casting platforms', SUBQS, { minClusterSize: 2 })
    const subtopics = plan.clusters.map((c) => c.subtopic)
    // "features" appears in 3 questions, "auditions" in 3 (incl. one with "audition"),
    // so we expect at minimum "features" to anchor a cluster.
    expect(subtopics).toContain('features')
  })

  it('drops core-topic terms from anchor candidates', () => {
    // "platforms" appears in 4 sub-questions, but it's part of the core
    // topic and so must NOT become a cluster anchor (would be redundant
    // with the pillar).
    const plan = planTopicCluster('Casting platforms', SUBQS, { minClusterSize: 2 })
    expect(plan.clusters.map((c) => c.subtopic)).not.toContain('platforms')
    expect(plan.clusters.map((c) => c.subtopic)).not.toContain('casting')
  })

  it('respects maxClusters cap', () => {
    const plan = planTopicCluster('Casting platforms', SUBQS, {
      maxClusters: 1,
      minClusterSize: 2,
    })
    expect(plan.clusters).toHaveLength(1)
  })

  it('drops clusters below minClusterSize and surfaces their questions as uncategorized', () => {
    const plan = planTopicCluster('Casting platforms', SUBQS, { minClusterSize: 10 })
    expect(plan.clusters).toHaveLength(0)
    expect(plan.uncategorized.length).toBe(SUBQS.length)
  })

  it('scores per-cluster + overall coverage when html is provided', () => {
    const html = `
      <h2>Features that matter on a casting platform</h2>
      <p>Profile customization, submission tracking, audition calendar and search filters are the features that matter.</p>
      <h2>How auditions are scheduled</h2>
      <p>Most casting platforms let productions create auditions with slot-based scheduling.</p>
    `
    const plan = planTopicCluster('Casting platforms', SUBQS, {
      html,
      minClusterSize: 2,
    })
    expect(plan.pillar.coverage).not.toBeNull()
    expect(plan.pillar.headings.length).toBeGreaterThan(0)
    for (const c of plan.clusters) {
      expect(c.coverage).not.toBeNull()
      expect(['strong', 'partial', 'weak']).toContain(c.verdict)
    }
  })

  it('returns an empty plan when no sub-questions supplied', () => {
    const plan = planTopicCluster('Anything', [])
    expect(plan.clusters).toHaveLength(0)
    expect(plan.uncategorized).toHaveLength(0)
    expect(plan.pillar.totalQuestions).toBe(0)
  })

  it('is diacritic-insensitive when grouping', () => {
    const plan = planTopicCluster('Kvalitet', [
      'Hur är kvalité och pålitlighet?',
      'Hur mäts kvalitet i tjänster?',
      'Vad kostar kvalitet?',
      'Hur skiljer sig pålitlighet från kvalitet?',
    ])
    // "pålitlighet" appears twice (diacritic-folded), should anchor a cluster.
    const subtopics = plan.clusters.map((c) => c.subtopic)
    expect(subtopics.some((s) => s.includes('palitlighet'))).toBe(true)
  })
})
