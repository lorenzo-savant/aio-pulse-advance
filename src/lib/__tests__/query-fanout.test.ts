import { describe, it, expect } from 'vitest'
import { extractContentSections, scoreFanoutCoverage } from '@/lib/utils/query-fanout'

const HTML = `<html><body>
  <h1>Casting Platform Guide</h1>
  <h2>What is a casting platform?</h2>
  <p>A casting platform connects actors with productions. They post calls and accept submissions.</p>
  <h2>How do casting platforms charge for use?</h2>
  <p>Most casting platforms charge a monthly subscription fee for talent and a per-job fee for productions.</p>
  <h3>What features matter most for actors?</h3>
  <p>Critical features include profile customization, submission tracking, and an audition calendar.</p>
</body></html>`

describe('extractContentSections', () => {
  it('extracts H2/H3 + first paragraph for each', () => {
    const secs = extractContentSections(HTML)
    expect(secs).toHaveLength(3)
    expect(secs[0]!.heading).toMatch(/casting platform/i)
    expect(secs[0]!.body).toMatch(/connects actors/)
  })

  it('falls back to a single section when the page has no H2/H3', () => {
    const flat = '<html><body><p>Just one big paragraph with no headings.</p></body></html>'
    const secs = extractContentSections(flat)
    expect(secs).toHaveLength(1)
    expect(secs[0]!.heading).toBe('(no headings)')
    expect(secs[0]!.body).toMatch(/Just one big paragraph/)
  })
})

describe('scoreFanoutCoverage', () => {
  it('counts a sub-question as covered when ALL of its terms hit one section', () => {
    const r = scoreFanoutCoverage(HTML, ['What features matter most for actors?'])
    expect(r.matches[0]!.covered).toBe(true)
    expect(r.matches[0]!.matchedHeading).toMatch(/features matter/i)
    expect(r.coverage).toBe(100)
  })

  it('counts a sub-question as uncovered when at least one meaningful term misses', () => {
    const r = scoreFanoutCoverage(HTML, ['How do casting platforms handle background checks?'])
    expect(r.matches[0]!.covered).toBe(false)
    expect(r.coverage).toBe(0)
  })

  it('computes coverage as percent with one decimal', () => {
    const r = scoreFanoutCoverage(HTML, [
      'What is a casting platform?', // covered
      'How do casting platforms charge for use?', // covered
      'What features matter most for actors?', // covered
      'Are there background checks for actors?', // miss
    ])
    expect(r.coverage).toBe(75)
  })

  it('returns 0 coverage when subQuestions is empty', () => {
    const r = scoreFanoutCoverage(HTML, [])
    expect(r.coverage).toBe(0)
    expect(r.matches).toEqual([])
  })

  it('classifies verdict by band (strong ≥70, partial ≥40, weak <40)', () => {
    expect(scoreFanoutCoverage(HTML, ['What is a casting platform?']).verdict).toBe('strong')
    expect(
      scoreFanoutCoverage(HTML, [
        'What is a casting platform?',
        'How do casting platforms handle background checks?',
      ]).verdict,
    ).toBe('partial')
    expect(scoreFanoutCoverage(HTML, ['xenon does what now?']).verdict).toBe('weak')
  })

  it('skips stop-words and short tokens when checking term presence', () => {
    // "How are you" has only the meaningful term "how" stripped + "you" stripped
    // → only "are" remains, which is also a stop-word → 0 meaningful terms → no match.
    const r = scoreFanoutCoverage(HTML, ['What is the for and with?'])
    expect(r.matches[0]!.covered).toBe(false)
  })

  it('match is diacritic-insensitive', () => {
    const html = `<h2>Quälitet hög</h2><p>Vi har bra qualité och hög tillförlitlighet.</p>`
    // Strip the accents on the question to make sure we're testing the
    // folder; "qualitet" in the question should match "Quälitet" in the
    // heading.
    const r = scoreFanoutCoverage(html, ['Hur är qualitet och tillförlitlighet?'])
    expect(r.matches[0]!.covered).toBe(true)
  })
})
