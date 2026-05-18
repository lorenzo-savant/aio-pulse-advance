import { describe, it, expect } from 'vitest'
import {
  PROMPT_TEMPLATES,
  PROMPT_CATEGORIES,
  hydratePrompt,
  getTemplatesByCategory,
  getTemplatesByCategories,
  type PromptCategory,
  type PromptLang,
  type PromptTemplate,
} from '../prompt-library'

const SUPPORTED_LANGS: PromptLang[] = ['en', 'it', 'sv']

describe('PROMPT_TEMPLATES catalogue', () => {
  it('contains exactly 70 templates', () => {
    expect(PROMPT_TEMPLATES.length).toBe(70)
  })

  it('every template has non-empty id, description, and all 3 language texts', () => {
    for (const t of PROMPT_TEMPLATES) {
      expect(t.id.length).toBeGreaterThan(0)
      expect(t.description.length).toBeGreaterThan(0)
      for (const lang of SUPPORTED_LANGS) {
        expect(t.texts[lang]).toBeDefined()
        expect(t.texts[lang].length).toBeGreaterThan(0)
      }
    }
  })

  it('placeholders present in EN are preserved in IT and SV translations', () => {
    const PLACEHOLDERS = /{(brand|category|competitor|competitor2|location|use_case)}/g
    for (const t of PROMPT_TEMPLATES) {
      const enPlaceholders = (t.texts.en.match(PLACEHOLDERS) || []).sort()
      for (const lang of ['it', 'sv'] as PromptLang[]) {
        const langPlaceholders = (t.texts[lang].match(PLACEHOLDERS) || []).sort()
        expect(langPlaceholders).toEqual(enPlaceholders)
      }
    }
  })

  it('all template ids are unique', () => {
    const ids = PROMPT_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every template category is a declared PromptCategory', () => {
    const categories = Object.keys(PROMPT_CATEGORIES)
    for (const t of PROMPT_TEMPLATES) {
      expect(categories).toContain(t.category)
    }
  })

  it('each of the 8 categories has at least one template', () => {
    const cats = Object.keys(PROMPT_CATEGORIES) as PromptCategory[]
    expect(cats.length).toBe(8)
    for (const cat of cats) {
      const items = PROMPT_TEMPLATES.filter((t) => t.category === cat)
      expect(items.length).toBeGreaterThan(0)
    }
  })
})

function makeTemplate(en: string, it: string = en, sv: string = en): PromptTemplate {
  return {
    id: 'TEST',
    category: 'discovery',
    description: 'test',
    texts: { en, it, sv },
  }
}

describe('hydratePrompt', () => {
  it('replaces {brand} placeholder in EN', () => {
    const t = makeTemplate('What is {brand}?')
    expect(hydratePrompt(t, 'en', { brand: 'Acme' })).toBe('What is Acme?')
  })

  it('uses the selected language variant', () => {
    const t = makeTemplate('What is {brand}?', "Cos'è {brand}?", 'Vad är {brand}?')
    expect(hydratePrompt(t, 'it', { brand: 'Acme' })).toBe("Cos'è Acme?")
    expect(hydratePrompt(t, 'sv', { brand: 'Acme' })).toBe('Vad är Acme?')
  })

  it('falls back to EN when language variant is missing', () => {
    const t: PromptTemplate = {
      id: 'T',
      category: 'discovery',
      description: 'test',
      texts: { en: 'Hello {brand}', it: '', sv: '' } as unknown as PromptTemplate['texts'],
    }
    // Passing an invalid lang falls back via nullish on undefined variant
    const result = hydratePrompt(t, 'xx' as PromptLang, { brand: 'Acme' })
    expect(result).toBe('Hello Acme')
  })

  it('replaces multiple placeholders', () => {
    const t = makeTemplate('{brand} vs {competitor} in {location}')
    const out = hydratePrompt(t, 'en', {
      brand: 'Acme',
      competitor: 'Zapier',
      location: 'Stockholm',
    })
    expect(out).toBe('Acme vs Zapier in Stockholm')
  })

  it('replaces all occurrences of the same placeholder', () => {
    const t = makeTemplate('{brand} and {brand}')
    expect(hydratePrompt(t, 'en', { brand: 'Acme' })).toBe('Acme and Acme')
  })

  it('replaces missing params with empty string', () => {
    const t = makeTemplate('Hello {brand} from {location}')
    expect(hydratePrompt(t, 'en', { brand: 'Acme' })).toBe('Hello Acme from ')
  })

  it('leaves unknown placeholders untouched', () => {
    const t = makeTemplate('Hi {unknown}')
    expect(hydratePrompt(t, 'en', {})).toBe('Hi {unknown}')
  })
})

describe('getTemplatesByCategory', () => {
  it('returns only templates matching the given category', () => {
    const discovery = getTemplatesByCategory('discovery')
    expect(discovery.length).toBeGreaterThan(0)
    expect(discovery.every((t) => t.category === 'discovery')).toBe(true)
  })
})

describe('getTemplatesByCategories', () => {
  it('returns all templates when categories is empty', () => {
    expect(getTemplatesByCategories([]).length).toBe(PROMPT_TEMPLATES.length)
  })

  it('returns union of requested categories', () => {
    const result = getTemplatesByCategories(['discovery', 'comparison'])
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((t) => t.category === 'discovery' || t.category === 'comparison')).toBe(
      true,
    )
  })
})
