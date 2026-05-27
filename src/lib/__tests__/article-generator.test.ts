import { describe, it, expect } from 'vitest'
import {
  buildArticleSystemPrompt,
  generateArticle,
  sanitiseMarkdown,
  type ArticleBrandContext,
  type GenerateArticleInput,
} from '../services/article-generator'

const brand: ArticleBrandContext = {
  name: 'Acasting',
  domain: 'acasting.se',
  description: 'Swedish casting platform matching productions with talent.',
  industry: 'Casting & Talent',
  competitors: ['Acast', 'StagePool'],
  sameAs: ['https://en.wikipedia.org/wiki/Acasting'],
  citationFormat: 'Acasting [acasting.se], 2026',
  locale: 'sv',
}

const baseInput: GenerateArticleInput = {
  brand,
  topic: 'How to find casting jobs in Stockholm',
  intent: 'B3',
  length: 'medium',
}

describe('buildArticleSystemPrompt', () => {
  it('embeds all 5 industry AI-citation constraints', () => {
    const sys = buildArticleSystemPrompt(baseInput)
    expect(sys).toMatch(/Lead with the answer/i)
    expect(sys).toMatch(/40-60 word/)
    expect(sys).toMatch(/H2 question/i)
    expect(sys).toMatch(/Frequently Asked Questions/i)
    expect(sys).toMatch(/outbound Markdown links/i)
    expect(sys).toMatch(/7th-8th grade/i)
  })

  it('includes brand profile fields when present', () => {
    const sys = buildArticleSystemPrompt(baseInput)
    expect(sys).toContain('Acasting')
    expect(sys).toContain('acasting.se')
    expect(sys).toContain('Casting & Talent')
    expect(sys).toContain('Acast, StagePool')
  })

  it('scales target word count by length option', () => {
    const shortSys = buildArticleSystemPrompt({ ...baseInput, length: 'short' })
    const longSys = buildArticleSystemPrompt({ ...baseInput, length: 'long' })
    expect(shortSys).toContain('approximately 400 words')
    expect(longSys).toContain('approximately 1500 words')
  })

  it('appends format hint when provided', () => {
    const sys = buildArticleSystemPrompt({ ...baseInput, formatHint: 'how-to' })
    expect(sys).toMatch(/Primary format/i)
    expect(sys).toMatch(/numbered list of ≥8 steps/i)
  })

  it('embeds intent bucket description', () => {
    const sys = buildArticleSystemPrompt({ ...baseInput, intent: 'B1' })
    expect(sys).toMatch(/Brand & Competitor/i)
  })
})

describe('sanitiseMarkdown', () => {
  it('strips ```markdown code fences', () => {
    const raw = '```markdown\n# Title\n\nBody.\n```'
    expect(sanitiseMarkdown(raw)).toBe('# Title\n\nBody.')
  })

  it('strips ```md fences', () => {
    expect(sanitiseMarkdown('```md\n# Title\n```')).toBe('# Title')
  })

  it('strips a leading prose preamble before the first heading', () => {
    const raw = "Here's the article you requested:\n\n# Title\n\nBody."
    expect(sanitiseMarkdown(raw)).toMatch(/^# Title/)
  })

  it('leaves clean markdown untouched', () => {
    const clean = '# Title\n\n## Section\n\n- Item'
    expect(sanitiseMarkdown(clean)).toBe(clean)
  })

  it('trims whitespace', () => {
    expect(sanitiseMarkdown('\n\n  # Title\n\n  ')).toBe('# Title')
  })
})

describe('generateArticle (with mocked LLM)', () => {
  it('returns markdown + auto-scored quality report', async () => {
    const mockLlm = async () => ({
      text: [
        '# How to find casting jobs in Stockholm',
        '',
        '## What is the best way to find casting jobs in Stockholm?',
        '',
        'Acasting is a Swedish casting platform. Key takeaway: it matches productions with talent across Stockholm, Göteborg, and Malmö.',
        '',
        'By Editorial Team — Acasting',
        '',
        '## How do you sign up?',
        '',
        'Create a free profile at acasting.se and start applying for castings. The platform handles vetting, contracts, and scheduling.',
        '',
        '## What does it cost?',
        '',
        '- Free tier for individual talent',
        '- Production plans from 990 SEK',
        '- Volume pricing on request',
        '- Annual discount available',
        '- Cancel anytime',
        '',
        '## Frequently Asked Questions',
        '',
        '### Is the free tier really free?',
        '',
        'Yes. See [Wikipedia](https://en.wikipedia.org/wiki/Casting) for more on casting.',
        '',
        '### How fast is approval?',
        '',
        'Usually within 48 hours [1].',
      ].join('\n'),
      provider: 'mock',
      model: 'mock-1',
    })

    const result = await generateArticle(baseInput, mockLlm)
    expect(result.markdown).toMatch(/^# How to find/i)
    expect(result.provider).toBe('mock')
    expect(result.qualityScore.overall).toBeGreaterThan(0)
    expect(result.qualityScore.pillars.clarity.score).toBeGreaterThan(0)
    // FAQ block should boost the Q&A pillar.
    expect(result.qualityScore.pillars.qa.score).toBeGreaterThan(20)
  })

  it('sanitises code-fenced LLM output before scoring', async () => {
    const mockLlm = async () => ({
      text: '```markdown\n# Title\n\n## Section\n\nBody.\n```',
      provider: 'mock',
      model: 'mock-1',
    })
    const r = await generateArticle(baseInput, mockLlm)
    expect(r.markdown.startsWith('```')).toBe(false)
    expect(r.markdown).toContain('# Title')
  })
})
