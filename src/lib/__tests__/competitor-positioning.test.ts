import { describe, it, expect } from 'vitest'
import {
  derivePositioningUrls,
  stripHtmlToText,
  extractJsonObject,
  buildPositioningPrompt,
  type PositioningPage,
} from '../services/competitor-positioning'

describe('competitor-positioning (pure logic)', () => {
  describe('derivePositioningUrls', () => {
    it('derives homepage/pricing/docs/changelog from a bare domain', () => {
      const urls = derivePositioningUrls('competitor.com')
      expect(urls.map((u) => u.kind)).toEqual(['homepage', 'pricing', 'docs', 'changelog'])
      expect(urls[1]).toEqual({ kind: 'pricing', url: 'https://competitor.com/pricing' })
    })

    it('accepts a full URL and normalizes to origin', () => {
      const urls = derivePositioningUrls('https://competitor.com/some/deep/path?q=1')
      expect(urls[0]?.url).toBe('https://competitor.com/')
    })

    it('returns [] for invalid input', () => {
      expect(derivePositioningUrls('not a url with spaces!!')).toEqual([])
    })
  })

  describe('stripHtmlToText', () => {
    it('removes scripts, styles and tags, collapsing whitespace', () => {
      const html =
        '<html><head><style>.x{color:red}</style></head><body><script>alert(1)</script><h1>Plan:  Pro</h1>\n\n<p>Beta&nbsp;feature</p></body></html>'
      const text = stripHtmlToText(html)
      expect(text).toBe('Plan: Pro Beta feature')
      expect(text).not.toContain('alert')
      expect(text).not.toContain('color:red')
    })
  })

  describe('extractJsonObject', () => {
    it('extracts JSON from a fenced code block', () => {
      const out = extractJsonObject('Here you go:\n```json\n{"findings":[],"summary":"ok"}\n```')
      expect(JSON.parse(out)).toEqual({ findings: [], summary: 'ok' })
    })

    it('extracts a bare JSON object from surrounding prose', () => {
      const out = extractJsonObject('blah {"summary":"x"} trailing')
      expect(JSON.parse(out)).toEqual({ summary: 'x' })
    })

    it('falls back to {} when no object present', () => {
      expect(extractJsonObject('no json here')).toBe('{}')
    })
  })

  describe('buildPositioningPrompt', () => {
    const pages: PositioningPage[] = [
      { kind: 'homepage', url: 'https://c.com/', ok: true, excerpt: 'Unlimited API calls!' },
      { kind: 'docs', url: 'https://c.com/docs', ok: true, excerpt: 'Rate limit: 100 req/min.' },
      { kind: 'pricing', url: 'https://c.com/pricing', ok: false, excerpt: '' },
    ]

    it('includes only successfully-fetched pages in the corpus', () => {
      const { user } = buildPositioningPrompt('CompC', pages)
      expect(user).toContain('Unlimited API calls!')
      expect(user).toContain('Rate limit: 100 req/min.')
      expect(user).toContain('homepage (https://c.com/)')
      expect(user).not.toContain('pricing (https://c.com/pricing)') // failed fetch excluded
    })

    it('instructs JSON-only output with the claim/reality dimensions', () => {
      const { system, user } = buildPositioningPrompt('CompC', pages)
      expect(system).toMatch(/claims/i)
      expect(user).toContain('beta_vs_ga')
      expect(user).toContain('"severity"')
    })

    it('handles the no-pages case gracefully', () => {
      const { user } = buildPositioningPrompt('CompC', [])
      expect(user).toContain('(no pages could be fetched)')
    })
  })
})
