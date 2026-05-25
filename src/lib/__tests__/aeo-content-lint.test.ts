import { describe, it, expect } from 'vitest'
import { lintAeoContent } from '../utils/aeo-content-lint'

describe('lintAeoContent', () => {
  it('returns a clean 100 score for empty input', () => {
    const r = lintAeoContent({})
    expect(r.score).toBe(100)
    expect(r.issues).toEqual([])
    expect(r.sectionsScanned).toBe(0)
  })

  it('flags a section whose first sentence does not restate the heading subject', () => {
    const r = lintAeoContent({
      markdown: [
        '## What Is AI Visibility?',
        'When thinking about modern search, brands often forget the basics.',
      ].join('\n'),
    })
    const headingIssues = r.issues.filter((i) => i.rule === 'heading-not-answered')
    expect(headingIssues).toHaveLength(1)
    expect(headingIssues[0]!.severity).toBe('high')
    expect(headingIssues[0]!.section).toBe('What Is AI Visibility?')
  })

  it('does not flag heading-not-answered when the first sentence restates the subject', () => {
    const r = lintAeoContent({
      markdown: [
        '## What Is AI Visibility?',
        'AI visibility is how often your brand appears in answers from ChatGPT, Perplexity, and Google AI Overview.',
      ].join('\n'),
    })
    expect(r.byRule['heading-not-answered']).toBe(0)
  })

  it('flags a section opening with a bare pronoun + auxiliary', () => {
    const r = lintAeoContent({
      markdown: ['## Enterprise AIO', 'It updates daily and tracks every prompt.'].join('\n'),
    })
    const ant = r.issues.filter((i) => i.rule === 'unclear-antecedent')
    expect(ant).toHaveLength(1)
    expect(ant[0]!.section).toBe('Enterprise AIO')
  })

  it('does not flag unclear-antecedent when the pronoun is followed by a noun', () => {
    const r = lintAeoContent({
      markdown: ['## Enterprise AIO', 'This guide explains how the tool works.'].join('\n'),
    })
    expect(r.byRule['unclear-antecedent']).toBe(0)
  })

  it('does not flag unclear-antecedent in preamble (no heading)', () => {
    const r = lintAeoContent({
      markdown: 'It is important to understand AI visibility before optimising for it.',
    })
    expect(r.byRule['unclear-antecedent']).toBe(0)
  })

  it('flags analogies and metaphors with low severity', () => {
    const r = lintAeoContent({
      markdown: [
        '## How It Works',
        'How it works is simple. AI visibility is the north star guiding ships through digital fog toward citation.',
      ].join('\n'),
    })
    const an = r.issues.filter((i) => i.rule === 'analogy-or-metaphor')
    expect(an.length).toBeGreaterThanOrEqual(2)
    expect(an[0]!.severity).toBe('low')
  })

  it('flags a vague qualifier when the sentence has no numeric proof', () => {
    const r = lintAeoContent({
      markdown: [
        '## Results',
        'Results were strong. Performance dramatically improved across every dimension.',
      ].join('\n'),
    })
    const vague = r.issues.filter((i) => i.rule === 'vague-claim')
    expect(vague).toHaveLength(1)
    expect(vague[0]!.message).toMatch(/dramatically/i)
  })

  it('does not flag a vague qualifier when the same sentence contains a number', () => {
    const r = lintAeoContent({
      markdown: [
        '## Results',
        'Results were strong. Performance dramatically improved by 23% in August 2025.',
      ].join('\n'),
    })
    expect(r.byRule['vague-claim']).toBe(0)
  })

  it('parses HTML input with h2/h3 sections', () => {
    const r = lintAeoContent({
      html: '<h2>What Is LLM Seeding?</h2><p>When thinking about modern search, brands struggle.</p><h3>Why It Matters</h3><p>It is the future of marketing.</p>',
    })
    // h2 trips heading-not-answered (no "LLM seeding" in first sentence).
    // h3 "Why It Matters" → subject "Matters" (pronoun "it" is filtered) — also
    // unanswered — and opens with "It is" → unclear-antecedent fires too.
    expect(r.byRule['heading-not-answered']).toBeGreaterThanOrEqual(1)
    expect(r.byRule['unclear-antecedent']).toBeGreaterThanOrEqual(1)
    expect(r.sectionsScanned).toBeGreaterThanOrEqual(2)
  })

  it('caps the score at 0 and accumulates penalties additively', () => {
    // Stack many high-severity heading-not-answered hits.
    const sections: string[] = []
    for (let i = 0; i < 20; i++) {
      sections.push(`## What Is Topic ${i}?`)
      sections.push('Something unrelated entirely.')
    }
    const r = lintAeoContent({ markdown: sections.join('\n') })
    expect(r.score).toBe(0)
    expect(r.byRule['heading-not-answered']).toBe(20)
  })

  it('counts issues by rule for quick aggregation', () => {
    const r = lintAeoContent({
      markdown: [
        '## Why Brand Mentions Matter',
        'It is critical to track them.',
        '## What Is North Star Strategy?',
        'A strategy aligns the team and acts like a north star for everyone.',
        '',
        'Adoption significantly improved last quarter.',
      ].join('\n'),
    })
    // Section 1: unclear-antecedent + heading-not-answered ("mentions matter" not restated)
    // Section 2: heading-not-answered + analogy-or-metaphor + vague-claim
    expect(r.byRule['unclear-antecedent']).toBeGreaterThanOrEqual(1)
    expect(r.byRule['analogy-or-metaphor']).toBeGreaterThanOrEqual(1)
    expect(r.byRule['vague-claim']).toBeGreaterThanOrEqual(1)
    expect(r.score).toBeLessThan(100)
  })
})
