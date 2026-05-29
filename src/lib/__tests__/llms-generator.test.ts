import { describe, it, expect } from 'vitest'
import {
  generateLlmsTxt,
  generateLlmsFullTxt,
  buildOrganizationJsonLd,
  buildKeyTakeaways,
  type LlmsInput,
} from '../services/llms-generator'

const baseInput: LlmsInput = {
  brandName: 'Acme Corp',
  domain: 'acme.com',
  description: 'B2B SaaS platform for workflow automation',
  industry: 'Software',
  aliases: ['Acme', 'AcmeCorp'],
  competitors: ['Zapier', 'Make'],
  products: [
    { name: 'Acme Flow', description: 'Visual workflow builder' },
    { name: 'Acme Connect', description: '500+ integrations' },
  ],
  keyFacts: {
    founded: '2015',
    headquarters: 'Stockholm, Sweden',
    specialties: ['automation', 'integration', 'SaaS'],
    employees: '150-200',
  },
  importantPages: [
    { title: 'Pricing', url: 'https://acme.com/pricing', description: 'Plans and pricing' },
    { title: 'Docs', url: 'https://acme.com/docs', description: 'API documentation' },
  ],
  faqs: [
    { question: 'What is Acme Flow?', answer: 'A visual automation builder' },
    { question: 'Do you offer a free tier?', answer: 'Yes, up to 100 runs/month' },
  ],
}

describe('generateLlmsTxt (spec-compliant per llmstxt.org)', () => {
  it('emits a v0.2 metadata header comment before the H1', () => {
    const out = generateLlmsTxt(baseInput)
    expect(out).toMatch(/^<!-- llms\.txt v0\.2 \|/)
  })

  it('includes the brand H1 heading', () => {
    const out = generateLlmsTxt(baseInput)
    expect(out).toContain('# Acme Corp')
  })

  it('includes blockquote summary', () => {
    const out = generateLlmsTxt(baseInput)
    expect(out).toContain('> B2B SaaS platform for workflow automation')
  })

  it('synthesizes a blockquote from industry when no description', () => {
    const out = generateLlmsTxt({ brandName: 'Bare', domain: 'bare.io', industry: 'Retail' })
    expect(out).toContain('> Bare — Retail.')
  })

  it('renders a curated Key Pages link list with the homepage first', () => {
    const out = generateLlmsTxt(baseInput)
    expect(out).toContain('## Key Pages')
    expect(out).toContain('- [Homepage](https://acme.com): Main website')
    expect(out).toContain('- [Pricing](https://acme.com/pricing): Plans and pricing')
    expect(out).toContain('- [Docs](https://acme.com/docs): API documentation')
  })

  it('is link-centric: no content sections (those belong in llms-full.txt)', () => {
    const out = generateLlmsTxt(baseInput)
    expect(out).not.toContain('## Products')
    expect(out).not.toContain('## Key Facts')
    expect(out).not.toContain('## About')
  })

  it('puts overflow links (>5) into an Optional section', () => {
    const manyPages: LlmsInput = {
      brandName: 'Acme Corp',
      domain: 'acme.com',
      importantPages: Array.from({ length: 7 }, (_, i) => ({
        title: `Page ${i + 1}`,
        url: `https://acme.com/p${i + 1}`,
        description: '',
      })),
    }
    const out = generateLlmsTxt(manyPages)
    expect(out).toContain('## Optional')
    // Homepage + 5 primary live under Key Pages; the 6th & 7th go to Optional.
    expect(out).toContain('- [Page 6](https://acme.com/p6)')
  })

  it('always has at least a Key Pages section with the homepage', () => {
    const minimal: LlmsInput = { brandName: 'Bare', domain: 'bare.io' }
    const out = generateLlmsTxt(minimal)
    expect(out).toContain('# Bare')
    expect(out).toContain('## Key Pages')
    expect(out).toContain('- [Homepage](https://bare.io): Main website')
    expect(out).not.toContain('## Optional')
  })

  it('ends with trailing newline', () => {
    const out = generateLlmsTxt(baseInput)
    expect(out.endsWith('\n')).toBe(true)
  })
})

describe('generateLlmsFullTxt', () => {
  it('is strictly longer than the short variant', () => {
    const short = generateLlmsTxt(baseInput)
    const full = generateLlmsFullTxt(baseInput)
    expect(full.length).toBeGreaterThan(short.length)
  })

  it('includes Brand Identity section', () => {
    const out = generateLlmsFullTxt(baseInput)
    expect(out).toContain('## Brand Identity')
    expect(out).toContain('- **Official Name**: Acme Corp')
    expect(out).toContain('- **Also Known As**: Acme, AcmeCorp')
    expect(out).toContain('- **Website**: https://acme.com')
    expect(out).toContain('- **Industry**: Software')
  })

  it('renders products as H3 headings with body', () => {
    const out = generateLlmsFullTxt(baseInput)
    expect(out).toContain('### Acme Flow')
    expect(out).toContain('Visual workflow builder')
    expect(out).toContain('### Acme Connect')
  })

  it('includes FAQ section with H3 questions', () => {
    const out = generateLlmsFullTxt(baseInput)
    expect(out).toContain('## Frequently Asked Questions')
    expect(out).toContain('### What is Acme Flow?')
    expect(out).toContain('A visual automation builder')
  })

  it('includes Market Context with competitors', () => {
    const out = generateLlmsFullTxt(baseInput)
    expect(out).toContain('## Market Context')
    expect(out).toContain('Zapier, Make')
  })

  it('includes footer with AEO Pulse attribution and ISO date', () => {
    const out = generateLlmsFullTxt(baseInput)
    expect(out).toContain('Generated by AEO Pulse Advance')
    expect(out).toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('emits a v0.2 metadata header HTML comment with locale and date', () => {
    const out = generateLlmsFullTxt({ ...baseInput, locale: 'sv-SE' })
    expect(out).toMatch(
      /<!-- llms-full\.txt v0\.2 \| locale: sv-SE \| updated: \d{4}-\d{2}-\d{2} -->/,
    )
  })

  it('surfaces a Disambiguation section when the field is set', () => {
    const out = generateLlmsFullTxt({
      ...baseInput,
      disambiguation:
        'Acme Corp is a Swedish workflow SaaS — NOT to be confused with Acme Inc. (US hardware).',
    })
    expect(out).toContain('## Disambiguation')
    expect(out).toContain('NOT to be confused with Acme Inc')
  })

  it('renders the Verified Identities (sameAs) section when URLs are present', () => {
    const out = generateLlmsFullTxt({
      ...baseInput,
      sameAs: ['https://wikidata.org/Q1', 'https://crunchbase.com/acme'],
    })
    expect(out).toContain('## Verified Identities (sameAs)')
    expect(out).toContain('- https://wikidata.org/Q1')
  })

  it('emits a Citation section when citationFormat is provided', () => {
    const out = generateLlmsFullTxt({ ...baseInput, citationFormat: 'AcmeCorp [acme.com], 2026' })
    expect(out).toContain('## Citation')
    expect(out).toContain('AcmeCorp [acme.com], 2026')
  })

  it('embeds a Structured Data JSON-LD code block', () => {
    const out = generateLlmsFullTxt(baseInput)
    expect(out).toContain('## Structured Data')
    expect(out).toContain('```json')
    expect(out).toContain('"@type": "Organization"')
  })
})

describe('buildOrganizationJsonLd', () => {
  it('returns a Schema.org Organization payload with the basics', () => {
    const payload = buildOrganizationJsonLd(baseInput)
    expect(payload['@context']).toBe('https://schema.org')
    expect(payload['@type']).toBe('Organization')
    expect(payload.name).toBe('Acme Corp')
    expect(payload.url).toBe('https://acme.com')
  })

  it('maps a single alias to alternateName as a string (not array)', () => {
    const payload = buildOrganizationJsonLd({ ...baseInput, aliases: ['Acme'] })
    expect(payload.alternateName).toBe('Acme')
  })

  it('maps multiple aliases to an array', () => {
    const payload = buildOrganizationJsonLd(baseInput)
    expect(payload.alternateName).toEqual(['Acme', 'AcmeCorp'])
  })

  it('maps disambiguation to disambiguatingDescription', () => {
    const payload = buildOrganizationJsonLd({
      ...baseInput,
      disambiguation: 'Not the same as Acme Inc.',
    })
    expect(payload.disambiguatingDescription).toBe('Not the same as Acme Inc.')
  })

  it('maps keyFacts to foundingDate / address / numberOfEmployees / knowsAbout', () => {
    const payload = buildOrganizationJsonLd(baseInput)
    expect(payload.foundingDate).toBe('2015')
    expect((payload.address as Record<string, unknown>).addressLocality).toBe('Stockholm, Sweden')
    expect(payload.numberOfEmployees).toBe('150-200')
    expect(payload.knowsAbout).toEqual(['automation', 'integration', 'SaaS'])
  })

  it('omits optional fields when not set', () => {
    const minimal = buildOrganizationJsonLd({ brandName: 'Bare', domain: 'bare.io' })
    expect(minimal.alternateName).toBeUndefined()
    expect(minimal.disambiguatingDescription).toBeUndefined()
    expect(minimal.sameAs).toBeUndefined()
    expect(minimal.foundingDate).toBeUndefined()
    expect(minimal.vatID).toBeUndefined()
    expect(minimal.taxID).toBeUndefined()
  })

  it('maps legalId with type=vat to Schema.org vatID', () => {
    const payload = buildOrganizationJsonLd({
      ...baseInput,
      legalId: 'SE556677889901',
      legalIdType: 'vat',
    })
    expect(payload.vatID).toBe('SE556677889901')
    expect(payload.taxID).toBeUndefined()
  })

  it('maps legalId with type=orgnr to Schema.org taxID', () => {
    const payload = buildOrganizationJsonLd({
      ...baseInput,
      legalId: '556677-8899',
      legalIdType: 'orgnr',
    })
    expect(payload.taxID).toBe('556677-8899')
    expect(payload.vatID).toBeUndefined()
  })

  it('falls back to taxID when legalIdType is not set', () => {
    const payload = buildOrganizationJsonLd({
      ...baseInput,
      legalId: '12345',
    })
    expect(payload.taxID).toBe('12345')
    expect(payload.vatID).toBeUndefined()
  })
})

describe('buildKeyTakeaways', () => {
  it('synthesises 3-5 bullets from the input', () => {
    const bullets = buildKeyTakeaways(baseInput)
    expect(bullets.length).toBeGreaterThanOrEqual(3)
    expect(bullets.length).toBeLessThanOrEqual(5)
  })

  it('includes industry when set', () => {
    const bullets = buildKeyTakeaways(baseInput)
    expect(bullets.some((b) => b.includes('Software'))).toBe(true)
  })

  it('includes HQ and founded together when both set', () => {
    const bullets = buildKeyTakeaways(baseInput)
    expect(bullets.some((b) => b.includes('Stockholm') && b.includes('2015'))).toBe(true)
  })

  it('returns empty array when input has no enriched data', () => {
    const bullets = buildKeyTakeaways({ brandName: 'Bare', domain: 'bare.io' })
    expect(bullets).toEqual([])
  })

  it('respects the 5-bullet cap', () => {
    const verbose: LlmsInput = {
      ...baseInput,
      legalId: 'IT12345678901',
      locale: 'it-IT',
    }
    const bullets = buildKeyTakeaways(verbose)
    expect(bullets.length).toBeLessThanOrEqual(5)
  })
})

describe('generateLlmsFullTxt — Key Takeaways section', () => {
  it('emits a "## Key Takeaways" section when input has enrichment', () => {
    const out = generateLlmsFullTxt(baseInput)
    expect(out).toContain('## Key Takeaways')
  })

  it('places Key Takeaways before About', () => {
    const out = generateLlmsFullTxt(baseInput)
    expect(out.indexOf('## Key Takeaways')).toBeLessThan(out.indexOf('## About'))
  })

  it('omits the section for minimal input with no enrichable fields', () => {
    const out = generateLlmsFullTxt({ brandName: 'Bare', domain: 'bare.io' })
    expect(out).not.toContain('## Key Takeaways')
  })
})

describe('generateLlmsFullTxt — legal identifier line', () => {
  it('emits a localised label per legalIdType under Brand Identity', () => {
    const swe = generateLlmsFullTxt({
      ...baseInput,
      legalId: '556677-8899',
      legalIdType: 'orgnr',
    })
    expect(swe).toContain('- **Organisationsnummer**: 556677-8899')

    const ita = generateLlmsFullTxt({
      ...baseInput,
      legalId: 'IT12345678901',
      legalIdType: 'fiscal_code',
    })
    expect(ita).toContain('- **Codice Fiscale**: IT12345678901')

    const vat = generateLlmsFullTxt({
      ...baseInput,
      legalId: 'SE556677889901',
      legalIdType: 'vat',
    })
    expect(vat).toContain('- **VAT Number**: SE556677889901')
  })

  it('falls back to "Legal Identifier" label when no type is set', () => {
    const out = generateLlmsFullTxt({ ...baseInput, legalId: '99999' })
    expect(out).toContain('- **Legal Identifier**: 99999')
  })
})
