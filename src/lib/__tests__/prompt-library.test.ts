import { describe, it, expect } from 'vitest'
import {
  PROMPT_TEMPLATES,
  PROMPT_CATEGORIES,
  hydratePrompt,
  getTemplatesByCategory,
  getTemplatesByCategories,
  type PromptCategory,
} from '../prompt-library'

describe('PROMPT_TEMPLATES catalogue', () => {
  it('contains exactly 70 templates', () => {
    expect(PROMPT_TEMPLATES.length).toBe(70)
  })

  it('every template has non-empty id, text and description', () => {
    for (const t of PROMPT_TEMPLATES) {
      expect(t.id.length).toBeGreaterThan(0)
      expect(t.text.length).toBeGreaterThan(0)
      expect(t.description.length).toBeGreaterThan(0)
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

describe('hydratePrompt', () => {
  it('replaces {brand} placeholder', () => {
    expect(hydratePrompt('What is {brand}?', { brand: 'Acme' })).toBe('What is Acme?')
  })

  it('replaces multiple placeholders', () => {
    const out = hydratePrompt('{brand} vs {competitor} in {location}', {
      brand: 'Acme',
      competitor: 'Zapier',
      location: 'Stockholm',
    })
    expect(out).toBe('Acme vs Zapier in Stockholm')
  })

  it('replaces all occurrences of the same placeholder', () => {
    expect(hydratePrompt('{brand} and {brand}', { brand: 'Acme' })).toBe('Acme and Acme')
  })

  it('replaces missing params with empty string', () => {
    expect(hydratePrompt('Hello {brand} from {location}', { brand: 'Acme' })).toBe(
      'Hello Acme from ',
    )
  })

  it('leaves unknown placeholders untouched', () => {
    expect(hydratePrompt('Hi {unknown}', {})).toBe('Hi {unknown}')
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
