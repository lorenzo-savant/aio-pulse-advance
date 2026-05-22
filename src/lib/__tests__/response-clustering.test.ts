import { describe, it, expect } from 'vitest'
import { clusterResponses, labelCluster, type ClusterInput } from '../services/response-clustering'

// Three obviously-separable directions in 3-D embedding space.
const X = [1, 0, 0]
const Y = [0, 1, 0]
const Z = [0, 0, 1]

const item = (id: string, text: string, embedding: number[], s?: number): ClusterInput => ({
  id,
  text,
  embedding,
  sentimentScore: s,
})

describe('labelCluster', () => {
  it('picks top content words, dropping stopwords', () => {
    const label = labelCluster([
      'The pricing is expensive and the support is great',
      'Pricing too expensive but pricing aside, support helped',
    ])
    // "pricing" most frequent; stopwords (the/is/and/but) excluded
    expect(label.split(' · ')[0]).toBe('pricing')
    expect(label).not.toContain('the')
  })

  it('falls back to misc when nothing meaningful', () => {
    expect(labelCluster(['the a an'])).toBe('misc')
  })
})

describe('clusterResponses', () => {
  it('groups similar embeddings into themes and separates dissimilar ones', () => {
    const items = [
      item('1', 'pricing expensive', X),
      item('2', 'pricing cost high', [0.96, 0.05, 0]),
      item('3', 'support helpful team', Y),
      item('4', 'support response fast', [0.04, 0.97, 0]),
    ]
    const themes = clusterResponses(items, { threshold: 0.8, minSize: 2 })
    expect(themes).toHaveLength(2)
    expect(themes[0]!.size).toBe(2)
    // shares sum to ~100
    expect(themes.reduce((s, t) => s + t.share, 0)).toBeCloseTo(100, 0)
  })

  it('drops singleton themes below minSize', () => {
    const items = [
      item('1', 'pricing', X),
      item('2', 'pricing cost', [0.97, 0.02, 0]),
      item('3', 'totally different topic', Z), // singleton
    ]
    const themes = clusterResponses(items, { threshold: 0.8, minSize: 2 })
    expect(themes).toHaveLength(1)
    expect(themes[0]!.memberIds).toEqual(['1', '2'])
  })

  it('averages sentiment per theme', () => {
    const items = [
      item('1', 'pricing good', X, 0.6),
      item('2', 'pricing fair', [0.98, 0.01, 0], 0.4),
    ]
    const themes = clusterResponses(items, { threshold: 0.8, minSize: 2 })
    expect(themes[0]!.avgSentiment).toBeCloseTo(0.5, 2)
  })

  it('caps the number of themes returned', () => {
    const items: ClusterInput[] = []
    // 5 distinct 5-D directions, 2 each
    for (let d = 0; d < 5; d++) {
      const base = [0, 0, 0, 0, 0]
      base[d] = 1
      items.push(item(`${d}a`, `topic${d}`, [...base]))
      const near = [...base]
      near[d] = 0.97
      items.push(item(`${d}b`, `topic${d} more`, near))
    }
    const themes = clusterResponses(items, { threshold: 0.8, minSize: 2, maxClusters: 3 })
    expect(themes.length).toBe(3)
  })

  it('ignores items with empty embeddings', () => {
    const themes = clusterResponses([item('1', 'a', []), item('2', 'b', [])], { minSize: 1 })
    expect(themes).toEqual([])
  })
})
