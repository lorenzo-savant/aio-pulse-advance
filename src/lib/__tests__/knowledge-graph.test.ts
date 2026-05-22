import { describe, it, expect } from 'vitest'
import {
  extractEntities,
  extractEeatSignals,
  calculateEeatScore,
  analyzeKnowledgeGraph,
  getKnowledgeGraphRecommendations,
  isAuthoritySameAs,
  type EeatSignals,
} from '../services/knowledge-graph'

describe('knowledge-graph', () => {
  describe('extractEntities', () => {
    it('should extract Organization entity', () => {
      const jsonLd = [
        {
          '@type': 'Organization',
          name: 'Acme Corp',
          url: 'https://acme.com',
          description: 'A leading company',
        },
      ]
      const entities = extractEntities(jsonLd)
      expect(entities).toHaveLength(1)
      if (entities[0]) {
        expect(entities[0].type).toBe('Organization')
        expect(entities[0].name).toBe('Acme Corp')
        expect(entities[0].url).toBe('https://acme.com')
      }
    })

    it('should extract Person entity', () => {
      const jsonLd = [
        {
          '@type': 'Person',
          name: 'John Doe',
          jobTitle: 'CEO',
          url: 'https://example.com/john',
        },
      ]
      const entities = extractEntities(jsonLd)
      expect(entities).toHaveLength(1)
      if (entities[0]) {
        expect(entities[0].type).toBe('Person')
        expect(entities[0].name).toBe('John Doe')
        expect(entities[0].properties?.jobTitle).toBe('CEO')
      }
    })

    it('should extract Product entity', () => {
      const jsonLd = [
        {
          '@type': 'Product',
          name: 'Super Widget',
          brand: 'Acme',
        },
      ]
      const entities = extractEntities(jsonLd)
      expect(entities).toHaveLength(1)
      if (entities[0]) {
        expect(entities[0].type).toBe('Product')
      }
    })

    it('should extract multiple entities', () => {
      const jsonLd = [
        { '@type': 'Organization', name: 'Org1' },
        { '@type': 'Person', name: 'Person1' },
        { '@type': 'Product', name: 'Product1' },
      ]
      const entities = extractEntities(jsonLd)
      expect(entities).toHaveLength(3)
    })

    it('should handle HowTo and Recipe types', () => {
      const jsonLd = [
        { '@type': 'HowTo', name: 'How to build' },
        { '@type': 'Recipe', name: 'Chocolate cake' },
      ]
      const entities = extractEntities(jsonLd)
      expect(entities).toHaveLength(2)
      if (entities[0]) {
        expect(entities[0].type).toBe('HowTo')
      }
      if (entities[1]) {
        expect(entities[1].type).toBe('Recipe')
      }
    })
  })

  describe('extractEeatSignals', () => {
    it('should detect author from JSON-LD', () => {
      const html = '<html><body>Test</body></html>'
      const jsonLd = [
        {
          '@type': 'Article',
          author: { name: 'John Doe', url: 'https://example.com/author/john' },
        },
      ]
      const signals = extractEeatSignals(html, jsonLd)
      expect(signals.author.present).toBe(true)
      expect(signals.author.name).toBe('John Doe')
      expect(signals.author.url).toBe('https://example.com/author/john')
    })

    it('should detect sameAs links', () => {
      const html = '<html><body>Test</body></html>'
      const jsonLd = [
        {
          '@type': 'Organization',
          name: 'Acme',
          sameAs: ['https://twitter.com/acme', 'https://wikipedia.org/wiki/Acme'],
        },
      ]
      const signals = extractEeatSignals(html, jsonLd)
      expect(signals.sameAs.present).toBe(true)
      expect(signals.sameAs.links).toContain('https://twitter.com/acme')
    })

    it('should detect credentials/awards', () => {
      const html = '<html><body>Test</body></html>'
      const jsonLd = [
        {
          '@type': 'Organization',
          name: 'Acme',
          awards: ['Best Company 2024'],
          certifications: ['ISO 9001'],
        },
      ]
      const signals = extractEeatSignals(html, jsonLd)
      expect(signals.credentials.present).toBe(true)
      expect(signals.credentials.values).toContain('Best Company 2024')
      expect(signals.credentials.values).toContain('ISO 9001')
    })

    it('should detect about page link', () => {
      const html = '<html><body><a href="/about">About Us</a></body></html>'
      const signals = extractEeatSignals(html, [])
      expect(signals.aboutPage.present).toBe(true)
    })

    it('should detect contact page link', () => {
      const html = '<html><body><a href="/contact-us">Contact</a></body></html>'
      const signals = extractEeatSignals(html, [])
      expect(signals.contactPage.present).toBe(true)
    })

    it('should detect external citations', () => {
      const html = '<html><body><a href="https://example.com/source">Source</a></body></html>'
      const signals = extractEeatSignals(html, [])
      expect(signals.externalCitations.present).toBe(true)
      expect(signals.externalCitations.count).toBe(1)
    })
  })

  describe('calculateEeatScore', () => {
    it('should return 0 for empty signals', () => {
      const signals: EeatSignals = {
        author: { present: false },
        sameAs: { present: false, links: [] },
        credentials: { present: false, values: [] },
        externalCitations: { present: false, count: 0, links: [] },
        aboutPage: { present: false },
        contactPage: { present: false },
      }
      expect(calculateEeatScore(signals)).toBe(0)
    })

    it('should return 15 for author only', () => {
      const signals: EeatSignals = {
        author: { present: true, name: 'John' },
        sameAs: { present: false, links: [] },
        credentials: { present: false, values: [] },
        externalCitations: { present: false, count: 0, links: [] },
        aboutPage: { present: false },
        contactPage: { present: false },
      }
      expect(calculateEeatScore(signals)).toBe(15)
    })

    it('should return full score (100) for all signals', () => {
      const signals: EeatSignals = {
        author: { present: true, name: 'John' },
        sameAs: { present: true, links: ['https://twitter.com/john'] },
        credentials: { present: true, values: ['ISO 9001'] },
        externalCitations: { present: true, count: 5, links: [] },
        aboutPage: { present: true },
        contactPage: { present: true },
      }
      expect(calculateEeatScore(signals)).toBe(100)
    })
  })

  describe('analyzeKnowledgeGraph', () => {
    it('should return complete analysis', () => {
      const html = `<html>
        <body>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
          <a href="https://example.com">External</a>
        </body>
      </html>`
      const jsonLd = [
        {
          '@type': 'Organization',
          name: 'Test Org',
          sameAs: ['https://twitter.com/john'],
        },
      ]
      const result = analyzeKnowledgeGraph(html, jsonLd)
      expect(result.entities).toHaveLength(1)
      expect(result.eeatScore).toBeGreaterThan(0)
      expect(result.eeatSignals.sameAs.present).toBe(true)
      expect(result.eeatSignals.aboutPage.present).toBe(true)
      expect(result.eeatSignals.contactPage.present).toBe(true)
    })
  })

  describe('Wikidata/Wikipedia KG anchoring', () => {
    it('flags Wikidata and Wikipedia among sameAs links', () => {
      const signals = extractEeatSignals('<html></html>', [
        {
          '@type': 'Organization',
          name: 'Acme',
          sameAs: [
            'https://twitter.com/acme',
            'https://www.wikidata.org/wiki/Q12345',
            'https://en.wikipedia.org/wiki/Acme',
          ],
        },
      ])
      expect(signals.sameAs.hasWikidata).toBe(true)
      expect(signals.sameAs.hasWikipedia).toBe(true)
      expect(signals.sameAs.authorityLinks).toHaveLength(2)
    })

    it('isAuthoritySameAs distinguishes KG anchors from social links', () => {
      expect(isAuthoritySameAs('https://www.wikidata.org/wiki/Q42')).toBe(true)
      expect(isAuthoritySameAs('https://it.wikipedia.org/wiki/Acme')).toBe(true)
      expect(isAuthoritySameAs('https://twitter.com/acme')).toBe(false)
    })

    it('recommends adding Wikidata/Wikipedia when missing', () => {
      const signals = extractEeatSignals('<html></html>', [
        { '@type': 'Organization', name: 'Acme', sameAs: ['https://twitter.com/acme'] },
      ])
      const recs = getKnowledgeGraphRecommendations(signals)
      expect(recs.some((r) => /Wikidata/.test(r))).toBe(true)
      expect(recs.some((r) => /Wikipedia/.test(r))).toBe(true)
    })

    it('analyzeKnowledgeGraph surfaces kgRecommendations', () => {
      const result = analyzeKnowledgeGraph('<html></html>', [
        { '@type': 'Organization', name: 'Acme' },
      ])
      expect(Array.isArray(result.kgRecommendations)).toBe(true)
      expect(result.kgRecommendations.length).toBeGreaterThan(0)
    })
  })
})
