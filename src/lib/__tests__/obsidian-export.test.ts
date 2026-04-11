import { describe, it, expect } from 'vitest'
import {
  generateSnapshotNote,
  generateHallucinationNote,
  generatePromptTestNote,
} from '../services/obsidian-export'

describe('generateSnapshotNote', () => {
  it('generates YAML frontmatter with type: snapshot', () => {
    const note = generateSnapshotNote({
      brandName: 'TestBrand',
      date: '2026-04-11',
      healthScore: 85,
      citationCount: 45,
      citationRate: 67.5,
      mentionCount: 60,
      mentionRate: 75.0,
      sentimentScore: 0.65,
      hallucinationRate: 5.2,
      visibilityScore: 82,
      hallucinationCount: 3,
      shareOfVoice: 45.0,
      positionAvg: 3.2,
      promptsTested: 100,
      platformsTested: ['chatgpt', 'gemini', 'perplexity'],
      engineBreakdown: {
        chatgpt: { citations: 20, rate: 66.7 },
        gemini: { citations: 15, rate: 50.0 },
        perplexity: { citations: 10, rate: 33.3 },
      },
    })

    expect(note.content.startsWith('---')).toBe(true)
    expect(note.content).toContain('type: snapshot')
    expect(note.content).toContain('client: TestBrand')
    expect(note.content).toContain('avi_score: 85')
  })

  it('creates correct filename and path', () => {
    const note = generateSnapshotNote({
      brandName: 'BrandName',
      date: '2026-04-11',
      healthScore: 80,
      citationCount: 30,
      citationRate: 60,
      mentionCount: 50,
      mentionRate: 70,
      sentimentScore: 0.5,
      hallucinationRate: 3,
      visibilityScore: 75,
      hallucinationCount: 2,
      shareOfVoice: 40,
      positionAvg: 4.5,
      promptsTested: 50,
      platformsTested: ['chatgpt'],
      engineBreakdown: { chatgpt: { citations: 30, rate: 60 } },
    })

    expect(note.filename).toBe('Snapshot-2026-04-11.md')
    expect(note.path).toBe('01-Clients/BrandName/Snapshots/')
  })

  it('includes metrics table in body', () => {
    const note = generateSnapshotNote({
      brandName: 'TestBrand',
      date: '2026-04-11',
      healthScore: 85,
      citationCount: 45,
      citationRate: 67.5,
      mentionCount: 60,
      mentionRate: 75.0,
      sentimentScore: 0.65,
      hallucinationRate: 5.2,
      visibilityScore: 82,
      hallucinationCount: 3,
      shareOfVoice: 45.0,
      positionAvg: 3.2,
      promptsTested: 100,
      platformsTested: ['chatgpt', 'gemini'],
      engineBreakdown: {
        chatgpt: { citations: 20, rate: 66.7 },
        gemini: { citations: 15, rate: 50.0 },
      },
    })

    expect(note.content).toContain('## Metrics Overview')
    expect(note.content).toContain('## Engine Breakdown')
    expect(note.content).toContain('| AVI Score | 85 |')
  })
})

describe('generateHallucinationNote', () => {
  it('creates filename with HAL-{date}-{seq} format', () => {
    const note = generateHallucinationNote({
      brandName: 'TestBrand',
      platform: 'chatgpt',
      date: '2026-04-11',
      seq: 1,
      severity: 'low',
      category: 'factual_error',
      claimMade: 'Brand was founded in 2020',
      reality: 'Brand was founded in 2019',
      promptUsed: 'When was TestBrand founded?',
      corrected: false,
    })

    expect(note.filename).toBe('HAL-2026-04-11-001.md')
    expect(note.path).toBe('01-Clients/TestBrand/Hallucinations/')
  })

  it('sets priority P1 for high severity', () => {
    const note = generateHallucinationNote({
      brandName: 'TestBrand',
      platform: 'chatgpt',
      date: '2026-04-11',
      seq: 5,
      severity: 'high',
      category: 'fabrication',
      claimMade: 'Brand has 10000 employees',
      reality: 'Brand has 500 employees',
      promptUsed: 'Tell me about TestBrand',
      corrected: false,
    })

    expect(note.content).toContain('priority: P1')
    expect(note.content).toContain('severity: high')
  })

  it('sets priority P2 for low severity', () => {
    const note = generateHallucinationNote({
      brandName: 'TestBrand',
      platform: 'gemini',
      date: '2026-04-10',
      seq: 2,
      severity: 'low',
      category: 'date_error',
      claimMade: 'Product launched in January',
      reality: 'Product launched in February',
      promptUsed: 'When did the product launch?',
      corrected: true,
    })

    expect(note.content).toContain('priority: P2')
    expect(note.content).toContain('corrected: true')
  })

  it('includes YAML frontmatter with all required fields', () => {
    const note = generateHallucinationNote({
      brandName: 'BrandName',
      platform: 'perplexity',
      date: '2026-04-11',
      seq: 1,
      severity: 'medium',
      category: 'attribution_error',
      claimMade: 'CEO said X',
      reality: 'COO said X',
      promptUsed: 'Who said X?',
      corrected: false,
    })

    expect(note.content.startsWith('---')).toBe(true)
    expect(note.content).toContain('type: hallucination')
    expect(note.content).toContain('client: BrandName')
    expect(note.content).toContain('platform: perplexity')
    expect(note.content).toContain('category: attribution_error')
    expect(note.content).toContain('claim_made: CEO said X')
  })
})

describe('generatePromptTestNote', () => {
  it('creates filename with PT-{date}-{seq} format', () => {
    const note = generatePromptTestNote({
      brandName: 'TestBrand',
      date: '2026-04-11',
      seq: 1,
      promptId: 'prompt-123',
      promptCategory: 'product',
      promptText: 'What are the features of TestBrand product?',
      platform: 'chatgpt',
      brandMentioned: true,
      position: 1,
      sentiment: 'positive',
      accuracy: 95,
      sourceCited: true,
      sourceUrl: 'https://example.com',
      competitorsMentioned: ['CompetitorA'],
      hallucinationDetected: false,
      hallucinationFlags: [],
    })

    expect(note.filename).toBe('PT-2026-04-11-001.md')
    expect(note.path).toBe('01-Clients/TestBrand/Prompt-Tests/')
  })

  it('sets brand_mentioned as boolean in YAML', () => {
    const note = generatePromptTestNote({
      brandName: 'TestBrand',
      date: '2026-04-11',
      seq: 1,
      promptId: 'prompt-123',
      promptCategory: 'general',
      promptText: 'Tell me about TestBrand',
      platform: 'gemini',
      brandMentioned: false,
      position: null,
      sentiment: 'neutral',
      accuracy: 80,
      sourceCited: false,
      sourceUrl: null,
      competitorsMentioned: [],
      hallucinationDetected: false,
      hallucinationFlags: [],
    })

    expect(note.content).toContain('brand_mentioned: false')
    expect(note.content).toContain('position:')
  })

  it('sets brand_mentioned as true when mentioned', () => {
    const note = generatePromptTestNote({
      brandName: 'TestBrand',
      date: '2026-04-11',
      seq: 1,
      promptId: 'prompt-123',
      promptCategory: 'general',
      promptText: 'Tell me about TestBrand',
      platform: 'perplexity',
      brandMentioned: true,
      position: 2,
      sentiment: 'positive',
      accuracy: 90,
      sourceCited: true,
      sourceUrl: 'https://docs.example.com',
      competitorsMentioned: ['CompA', 'CompB'],
      hallucinationDetected: false,
      hallucinationFlags: [],
    })

    expect(note.content).toContain('brand_mentioned: true')
    expect(note.content).toContain('position: 2')
    expect(note.content).toContain('competitors_mentioned: [CompA, CompB]')
  })

  it('includes hallucination check section when detected', () => {
    const note = generatePromptTestNote({
      brandName: 'TestBrand',
      date: '2026-04-11',
      seq: 1,
      promptId: 'prompt-123',
      promptCategory: 'general',
      promptText: 'What year was TestBrand founded?',
      platform: 'chatgpt',
      brandMentioned: true,
      position: 1,
      sentiment: 'neutral',
      accuracy: 70,
      sourceCited: false,
      sourceUrl: null,
      competitorsMentioned: [],
      hallucinationDetected: true,
      hallucinationFlags: [
        {
          text: 'Incorrect founding year mentioned',
          severity: 'medium',
          type: 'date_error',
        },
      ],
    })

    expect(note.content).toContain('hallucination_detected: true')
    expect(note.content).toContain('## Hallucination Check')
    expect(note.content).toContain('**[MEDIUM]** Incorrect founding year mentioned')
  })
})

describe('YAML frontmatter validation', () => {
  it('all notes start with YAML delimiter', () => {
    const snapshot = generateSnapshotNote({
      brandName: 'Brand',
      date: '2026-04-11',
      healthScore: 80,
      citationCount: 40,
      citationRate: 60,
      mentionCount: 50,
      mentionRate: 75,
      sentimentScore: 0.5,
      hallucinationRate: 5,
      visibilityScore: 70,
      hallucinationCount: 2,
      shareOfVoice: 40,
      positionAvg: 3,
      promptsTested: 50,
      platformsTested: ['chatgpt'],
      engineBreakdown: { chatgpt: { citations: 40, rate: 60 } },
    })

    const hallucination = generateHallucinationNote({
      brandName: 'Brand',
      platform: 'chatgpt',
      date: '2026-04-11',
      seq: 1,
      severity: 'low',
      category: 'factual_error',
      claimMade: 'Test claim',
      reality: 'Test reality',
      promptUsed: 'Test prompt',
      corrected: false,
    })

    const promptTest = generatePromptTestNote({
      brandName: 'Brand',
      date: '2026-04-11',
      seq: 1,
      promptId: 'p1',
      promptCategory: 'general',
      promptText: 'Test',
      platform: 'chatgpt',
      brandMentioned: true,
      position: 1,
      sentiment: 'positive',
      accuracy: 90,
      sourceCited: true,
      sourceUrl: 'https://test.com',
      competitorsMentioned: [],
      hallucinationDetected: false,
      hallucinationFlags: [],
    })

    expect(snapshot.content.startsWith('---\n')).toBe(true)
    expect(hallucination.content.startsWith('---\n')).toBe(true)
    expect(promptTest.content.startsWith('---\n')).toBe(true)
  })
})
