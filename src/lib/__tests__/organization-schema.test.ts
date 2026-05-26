import { describe, it, expect } from 'vitest'
import {
  emitOrganizationScriptTag,
  emitOrganizationJsonLd,
  emitBrandKnowledgeGraph,
} from '../utils/organization-schema'
import type { LlmsInput } from '../services/llms-generator'

const acme: LlmsInput = {
  brandName: 'Acme Corp',
  domain: 'acme.com',
  description: 'Workflow automation SaaS',
  industry: 'Software',
  aliases: ['Acme'],
  sameAs: [
    'https://en.wikipedia.org/wiki/Acme_Corp',
    'https://www.crunchbase.com/organization/acme',
  ],
  locale: 'en-US',
  keyFacts: { founded: '2015', headquarters: 'Stockholm' },
}

describe('organization-schema', () => {
  it('emits a complete <script type="application/ld+json"> block', () => {
    const out = emitOrganizationScriptTag(acme)
    expect(out.startsWith('<script type="application/ld+json">')).toBe(true)
    expect(out.endsWith('</script>')).toBe(true)
    expect(out).toContain('"@type": "Organization"')
    expect(out).toContain('"name": "Acme Corp"')
  })

  it('includes the alternateName when aliases are provided', () => {
    const json = JSON.parse(emitOrganizationJsonLd(acme))
    expect(json.alternateName).toBe('Acme')
  })

  it('includes sameAs URLs verbatim', () => {
    const json = JSON.parse(emitOrganizationJsonLd(acme))
    expect(json.sameAs).toContain('https://en.wikipedia.org/wiki/Acme_Corp')
  })

  it('escapes </script> in the payload to prevent breakout', () => {
    const out = emitOrganizationScriptTag({
      ...acme,
      description: 'A brand </script><script>alert(1)</script> with payload',
    })
    expect(out).not.toMatch(/<\/script>[^]*<script>alert/) // sequence is broken
    // Defensive escape preserves data while neutralising the attack vector.
    expect(out).toContain('<\\/script>')
  })

  it('omits Address when headquarters is missing', () => {
    const json = JSON.parse(emitOrganizationJsonLd({ ...acme, keyFacts: { founded: '2020' } }))
    expect(json.address).toBeUndefined()
  })

  it('emits a brand knowledge graph with Organization + WebSite', () => {
    const graph = emitBrandKnowledgeGraph(acme)
    expect(graph['@context']).toBe('https://schema.org')
    const items = graph['@graph'] as Array<{ '@type': string }>
    expect(items.map((n) => n['@type'])).toEqual(['Organization', 'WebSite'])
  })

  it('inner @context is removed when embedded in @graph', () => {
    const graph = emitBrandKnowledgeGraph(acme)
    const items = graph['@graph'] as Array<Record<string, unknown>>
    expect(items[0]!['@context']).toBeUndefined()
  })
})
