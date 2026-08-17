// PATH: src/lib/__tests__/docs-content.test.ts
//
// The three locale files are maintained by hand, so the thing that breaks is
// structural drift: a section added to en.ts and forgotten in sv.ts, or an id
// renamed in one file only. Ids are deep-link anchors and the language switcher
// keeps the reader on the same section, so an id mismatch is a broken link, not
// a cosmetic issue. These tests fail loudly on that.

import { describe, it, expect } from 'vitest'
import { locales, defaultLocale, type Locale } from '@/i18n/config'
import { DOC_CONTENT, getDocContent } from '@/content/docs'
import { isStepBlock, matchStepLine } from '@/content/docs/render'
import { DOC_ICONS } from '@/components/docs/docIcons'

const structure = (locale: Locale) =>
  DOC_CONTENT[locale].map((g) => ({ id: g.id, sections: g.sections.map((s) => s.id) }))

describe('docs content', () => {
  it('covers every configured locale', () => {
    for (const locale of locales) {
      expect(DOC_CONTENT[locale], `missing content for ${locale}`).toBeDefined()
      expect(DOC_CONTENT[locale].length).toBeGreaterThan(0)
    }
  })

  it('has an identical group and section structure in all locales', () => {
    const reference = structure(defaultLocale)
    for (const locale of locales) {
      expect(structure(locale), `structure drift in ${locale}.ts`).toEqual(reference)
    }
  })

  it('never leaves a section untranslated', () => {
    // A section whose title and body are byte-identical to the default locale in
    // another language is almost certainly a copy-paste that was never
    // translated. Ids are excluded because they are meant to be identical.
    for (const locale of locales) {
      if (locale === defaultLocale) continue
      DOC_CONTENT[locale].forEach((group, gi) => {
        const ref = DOC_CONTENT[defaultLocale][gi]
        if (!ref) return
        group.sections.forEach((section, si) => {
          const refSection = ref.sections[si]
          if (!refSection) return
          expect(
            section.title === refSection.title && section.content === refSection.content,
            `${locale}.ts § ${section.id} is identical to ${defaultLocale} — untranslated?`,
          ).toBe(false)
        })
      })
    }
  })

  it('uses unique section ids across the whole document', () => {
    for (const locale of locales) {
      const ids = DOC_CONTENT[locale].flatMap((g) => g.sections.map((s) => s.id))
      expect(new Set(ids).size, `duplicate section id in ${locale}.ts`).toBe(ids.length)
    }
  })

  it('only references icon keys that have a component', () => {
    for (const locale of locales) {
      for (const group of DOC_CONTENT[locale]) {
        expect(DOC_ICONS[group.icon], `no icon for key "${group.icon}"`).toBeDefined()
      }
    }
  })

  it('renders step blocks in every locale, not only English', () => {
    // Regression guard: the renderer used to detect steps with /^Step \d/, so
    // the Italian and Swedish quick-start sections lost their numbered styling
    // the moment the content was translated.
    for (const locale of locales) {
      const quickStart = DOC_CONTENT[locale]
        .flatMap((g) => g.sections)
        .find((s) => s.id === 'quick-start')
      expect(quickStart, `no quick-start section in ${locale}.ts`).toBeDefined()

      const stepParagraphs = (quickStart?.content ?? '').split('\n\n').filter((p) => isStepBlock(p))
      expect(stepParagraphs.length, `no step blocks detected in ${locale}.ts`).toBeGreaterThan(0)

      for (const paragraph of stepParagraphs) {
        const firstLine = paragraph.split('\n')[0] ?? ''
        expect(
          matchStepLine(firstLine),
          `unparsed step line in ${locale}.ts: ${firstLine}`,
        ).not.toBeNull()
      }
    }
  })

  it('falls back to the default locale for anything unrecognised', () => {
    expect(getDocContent('de')).toBe(DOC_CONTENT[defaultLocale])
    expect(getDocContent('')).toBe(DOC_CONTENT[defaultLocale])
    expect(getDocContent('it')).toBe(DOC_CONTENT.it)
  })
})
