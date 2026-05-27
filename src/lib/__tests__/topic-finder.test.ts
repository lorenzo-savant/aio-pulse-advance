import { describe, it, expect } from 'vitest'
import { findTopics, type TopicInputRow } from '../services/topic-finder'

function row(prompt_text: string, engine = 'chatgpt', citedInstead: string[] = []): TopicInputRow {
  return { prompt_text, engine, citedInstead }
}

describe('findTopics — empty input', () => {
  it('returns zero clusters on empty input', () => {
    const r = findTopics([])
    expect(r.totalGapPrompts).toBe(0)
    expect(r.clusters).toHaveLength(0)
  })

  it('skips prompts shorter than 6 chars', () => {
    const r = findTopics([row('hi'), row('xx')])
    expect(r.totalGapPrompts).toBe(0)
  })
})

describe('findTopics — clustering', () => {
  it('groups prompts that share a 2- or 3-word phrase', () => {
    const r = findTopics([
      row('What is the best casting platform in Sweden?', 'chatgpt', ['wikipedia.org']),
      row('Best casting platform Stockholm reviews', 'gemini', ['acast.com']),
      row('Best casting platforms 2026', 'perplexity', ['variety.com']),
      row('How to find a job in Stockholm', 'chatgpt', ['linkedin.com']),
    ])
    expect(r.totalGapPrompts).toBe(4)
    // The "casting platform" cluster should exist.
    const castingCluster = r.clusters.find((c) => c.topic.includes('casting'))
    expect(castingCluster).toBeDefined()
    expect(castingCluster!.promptCount).toBeGreaterThanOrEqual(2)
  })

  it('engineCount reflects distinct engines in the cluster', () => {
    const r = findTopics([
      row('best casting platform', 'chatgpt'),
      row('best casting platform stockholm', 'gemini'),
      row('best casting platform reviews', 'perplexity'),
    ])
    const cluster = r.clusters[0]
    expect(cluster).toBeDefined()
    expect(cluster!.engineCount).toBe(3)
  })

  it('competitorCount + topCompetitors come from citedInstead', () => {
    const r = findTopics([
      row('best casting platform', 'chatgpt', ['acast.com', 'wikipedia.org']),
      row('best casting platform reviews', 'gemini', ['acast.com', 'variety.com']),
      row('best casting platform 2026', 'perplexity', ['variety.com']),
    ])
    const cluster = r.clusters[0]
    expect(cluster).toBeDefined()
    // acast appeared twice → first in topCompetitors
    expect(cluster!.topCompetitors[0]).toBe('acast.com')
    expect(cluster!.competitorCount).toBe(3)
  })
})

describe('findTopics — format detection', () => {
  it('detects comparison format', () => {
    const r = findTopics([
      row('acasting platform vs acast platform pricing', 'chatgpt'),
      row('acasting platform versus acast comparison features', 'gemini'),
    ])
    expect(r.clusters[0]?.suggestedFormat).toBe('comparison')
  })

  it('detects how-to format', () => {
    const r = findTopics([
      row('how to find casting jobs stockholm online', 'chatgpt'),
      row('how to find casting roles sweden actors', 'gemini'),
    ])
    expect(r.clusters[0]?.suggestedFormat).toBe('how-to')
  })

  it('detects pricing/table format', () => {
    const r = findTopics([
      row('acasting pricing plans cost subscription', 'chatgpt'),
      row('acasting pricing review monthly cost', 'gemini'),
    ])
    expect(r.clusters[0]?.suggestedFormat).toBe('table')
  })

  it('detects ranked-list format for "best X" queries', () => {
    const r = findTopics([
      row('best casting platforms sweden actors', 'chatgpt'),
      row('best casting platforms stockholm reviews', 'gemini'),
    ])
    expect(['list', 'comparison']).toContain(r.clusters[0]?.suggestedFormat)
  })
})

describe('findTopics — priority scoring', () => {
  it('ranks higher-impact clusters first', () => {
    const r = findTopics([
      // Cluster A: 3 prompts, 3 engines, 2 competitors
      row('best casting platform sweden', 'chatgpt', ['acast.com', 'variety.com']),
      row('best casting platform reviews', 'gemini', ['acast.com']),
      row('best casting platform 2026', 'perplexity', ['variety.com']),
      // Cluster B: 2 prompts, 1 engine, 1 competitor
      row('audition tips stockholm', 'chatgpt', ['blog.com']),
      row('audition tips beginners', 'chatgpt', ['blog.com']),
    ])
    const topPriority = r.clusters[0]!.priorityScore
    const secondPriority = r.clusters[1]?.priorityScore ?? 0
    expect(topPriority).toBeGreaterThanOrEqual(secondPriority)
  })

  it('normalises max priority to 100', () => {
    const r = findTopics([
      row('best casting platform sweden', 'chatgpt', ['acast.com']),
      row('best casting platform stockholm', 'gemini', ['acast.com']),
    ])
    expect(r.clusters[0]!.priorityScore).toBe(100)
  })
})

describe('findTopics — Italian + Swedish stopwords', () => {
  it('clusters Italian prompts correctly', () => {
    const r = findTopics([
      row('migliori piattaforme casting Milano', 'chatgpt', ['x.com']),
      row('migliori piattaforme casting Roma', 'gemini', ['y.com']),
    ])
    expect(r.clusters.length).toBeGreaterThan(0)
    expect(r.clusters[0]?.topic).toContain('piattaforme casting')
  })

  it('clusters Swedish prompts correctly', () => {
    const r = findTopics([
      row('bästa castingplattform Stockholm 2026', 'chatgpt', ['x.com']),
      row('bästa castingplattform Göteborg recension', 'gemini', ['y.com']),
    ])
    expect(r.clusters.length).toBeGreaterThan(0)
  })
})

describe('findTopics — cluster cap', () => {
  it('caps the output at maxClusters', () => {
    // Generate 20 distinct 2-prompt clusters.
    const rows: TopicInputRow[] = []
    for (let i = 0; i < 20; i++) {
      rows.push(row(`unique topic alpha_${i} bravo`, 'chatgpt'))
      rows.push(row(`unique topic alpha_${i} charlie`, 'gemini'))
    }
    const r = findTopics(rows, { maxClusters: 5 })
    expect(r.clusters.length).toBeLessThanOrEqual(5)
  })
})
