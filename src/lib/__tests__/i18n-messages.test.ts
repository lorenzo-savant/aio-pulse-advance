import { describe, it, expect } from 'vitest'
import enMessages from '@/i18n/messages/en.json'
import itMessages from '@/i18n/messages/it.json'
import svMessages from '@/i18n/messages/sv.json'

type Messages = Record<string, unknown>

const messagesByLocale: Record<string, Messages> = {
  en: enMessages as Messages,
  it: itMessages as Messages,
  sv: svMessages as Messages,
}

const LOCALES = ['en', 'it', 'sv'] as const

function getAllKeys(obj: Messages, prefix = ''): string[] {
  const keys: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...getAllKeys(value as Messages, fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

function getNestedValue(obj: Messages, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Messages)[part]
    }
    return undefined
  }, obj)
}

function extractPlaceholders(text: string): string[] {
  const matches = text.match(/\{(\w+)\}/g) ?? []
  return matches.map((m) => m.slice(1, -1))
}

function getNamespace(obj: Messages, namespace: string): Messages {
  const ns = obj[namespace]
  if (ns && typeof ns === 'object' && !Array.isArray(ns)) {
    return ns as Messages
  }
  return {}
}

describe('i18n messages', () => {
  describe('key parity across locales', () => {
    it('all locales have the same top-level namespaces', () => {
      const enKeys = Object.keys(enMessages as Messages)
      for (const locale of LOCALES) {
        const localeKeys = Object.keys(messagesByLocale[locale]!!)
        expect(localeKeys.sort()).toEqual(enKeys.sort())
      }
    })

    it('all locales have the same keys in onboarding namespace', () => {
      const enKeys = getAllKeys(getNamespace(messagesByLocale['en']!, 'onboarding'))
      for (const locale of LOCALES) {
        const localeKeys = getAllKeys(getNamespace(messagesByLocale[locale]!!, 'onboarding'))
        expect(localeKeys.sort()).toEqual(enKeys.sort())
      }
    })

    it('all locales have the same keys in brands namespace', () => {
      const enKeys = getAllKeys(getNamespace(messagesByLocale['en']!, 'brands'))
      for (const locale of LOCALES) {
        const localeKeys = getAllKeys(getNamespace(messagesByLocale[locale]!!, 'brands'))
        expect(localeKeys.sort()).toEqual(enKeys.sort())
      }
    })

    it('all locales have the same keys in prompts namespace', () => {
      const enKeys = getAllKeys(getNamespace(messagesByLocale['en']!, 'prompts'))
      for (const locale of LOCALES) {
        const localeKeys = getAllKeys(getNamespace(messagesByLocale[locale]!!, 'prompts'))
        expect(localeKeys.sort()).toEqual(enKeys.sort())
      }
    })

    it('all locales have the same keys in sidebar namespace', () => {
      const enKeys = getAllKeys(getNamespace(messagesByLocale['en']!, 'sidebar'))
      for (const locale of LOCALES) {
        const localeKeys = getAllKeys(getNamespace(messagesByLocale[locale]!!, 'sidebar'))
        expect(localeKeys.sort()).toEqual(enKeys.sort())
      }
    })

    it('all locales have the same keys in common namespace', () => {
      const enKeys = getAllKeys(getNamespace(messagesByLocale.en!, 'common'))
      for (const locale of LOCALES) {
        const localeKeys = getAllKeys(getNamespace(messagesByLocale[locale]!, 'common'))
        expect(localeKeys.sort()).toEqual(enKeys.sort())
      }
    })
  })

  describe('placeholder preservation', () => {
    it('translations preserve placeholders between locales', () => {
      const enKeys = getAllKeys(messagesByLocale.en!)

      let checkedCount = 0
      let mismatchCount = 0

      for (const key of enKeys) {
        const enValue = getNestedValue(messagesByLocale.en!, key)
        if (typeof enValue !== 'string') continue

        const enPlaceholders = extractPlaceholders(enValue)

        for (const locale of ['it', 'sv'] as const) {
          const localeValue = getNestedValue(messagesByLocale[locale]!, key)
          if (typeof localeValue !== 'string') continue

          const localePlaceholders = extractPlaceholders(localeValue)

          if (localePlaceholders.sort().join(',') !== enPlaceholders.sort().join(',')) {
            mismatchCount++
          }
          checkedCount++
        }
      }

      expect(
        mismatchCount,
        `${mismatchCount} placeholder mismatches out of ${checkedCount} checked`,
      ).toBe(0)
    })
  })

  describe('common translations', () => {
    it('all locales have common keys like save, cancel, delete', () => {
      const requiredCommonKeys = ['save', 'cancel', 'delete', 'loading', 'error', 'success']

      for (const key of requiredCommonKeys) {
        for (const locale of LOCALES) {
          const value = getNestedValue(getNamespace(messagesByLocale[locale]!, 'common'), key)
          expect(value).toBeDefined()
          expect(typeof value).toBe('string')
          expect((value as string).length).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('onboarding translations', () => {
    it('welcome screen keys exist in all locales', () => {
      const welcomeKeys = [
        'welcome_screen.title',
        'welcome_screen.subtitle',
        'welcome_screen.add_brand',
        'welcome_screen.get_started',
      ]

      for (const key of welcomeKeys) {
        for (const locale of LOCALES) {
          const value = getNestedValue(getNamespace(messagesByLocale[locale]!, 'onboarding'), key)
          expect(value).toBeDefined()
          expect(typeof value).toBe('string')
        }
      }
    })

    it('brand form keys exist in all locales', () => {
      const formKeys = [
        'brand_form.name_label',
        'brand_form.name_placeholder',
        'brand_form.language_helper',
      ]

      for (const key of formKeys) {
        for (const locale of LOCALES) {
          const value = getNestedValue(getNamespace(messagesByLocale[locale]!, 'onboarding'), key)
          expect(value).toBeDefined()
        }
      }
    })

    it('launch screen keys exist in all locales', () => {
      const launchKeys = [
        'launch_screen.title',
        'launch_screen.ai_engines',
        'launch_stages.creating_brand',
      ]

      for (const key of launchKeys) {
        for (const locale of LOCALES) {
          const value = getNestedValue(getNamespace(messagesByLocale[locale]!, 'onboarding'), key)
          expect(value).toBeDefined()
        }
      }
    })
  })

  describe('brands translations', () => {
    it('page title and subtitle exist in all locales', () => {
      for (const locale of LOCALES) {
        expect(getNamespace(messagesByLocale[locale]!, 'brands')['page_title']).toBeDefined()
        expect(getNamespace(messagesByLocale[locale]!, 'brands')['page_subtitle']).toBeDefined()
      }
    })

    it('journey guide keys exist in all locales', () => {
      const guideKeys = ['journey_guide.title', 'journey_guide.lead', 'journey_guide.cta']

      for (const key of guideKeys) {
        for (const locale of LOCALES) {
          const value = getNestedValue(getNamespace(messagesByLocale[locale]!, 'brands'), key)
          expect(value).toBeDefined()
        }
      }
    })
  })

  describe('prompts translations', () => {
    it('form labels exist in all locales', () => {
      const formKeys = [
        'form.create_title',
        'form.brand_label',
        'form.text_label',
        'form.quick_templates',
      ]

      for (const key of formKeys) {
        for (const locale of LOCALES) {
          const value = getNestedValue(getNamespace(messagesByLocale[locale]!, 'prompts'), key)
          expect(value).toBeDefined()
        }
      }
    })

    it('journey guide steps exist in all locales', () => {
      const stepKeys = [
        'journey_guide.steps.open_library',
        'journey_guide.steps.write_own',
        'journey_guide.steps.pick_engines',
      ]

      for (const key of stepKeys) {
        for (const locale of LOCALES) {
          const value = getNestedValue(getNamespace(messagesByLocale[locale]!, 'prompts'), key)
          expect(value).toBeDefined()
        }
      }
    })
  })

  describe('no untranslated content in UI namespaces', () => {
    it('IT translations differ from EN for onboarding namespace', () => {
      const enOnboarding = getNamespace(messagesByLocale.en!, 'onboarding')
      const itOnboarding = getNamespace(messagesByLocale.it!, 'onboarding')
      const enKeys = getAllKeys(enOnboarding)

      let translatedCount = 0
      for (const key of enKeys) {
        const enValue = getNestedValue(enOnboarding, key)
        const itValue = getNestedValue(itOnboarding, key)
        if (typeof enValue === 'string' && typeof itValue === 'string' && enValue !== itValue) {
          translatedCount++
        }
      }

      expect(translatedCount).toBeGreaterThan(0)
    })

    it('SV translations differ from EN for onboarding namespace', () => {
      const enOnboarding = getNamespace(messagesByLocale.en!, 'onboarding')
      const svOnboarding = getNamespace(messagesByLocale.sv!, 'onboarding')
      const enKeys = getAllKeys(enOnboarding)

      let translatedCount = 0
      for (const key of enKeys) {
        const enValue = getNestedValue(enOnboarding, key)
        const svValue = getNestedValue(svOnboarding, key)
        if (typeof enValue === 'string' && typeof svValue === 'string' && enValue !== svValue) {
          translatedCount++
        }
      }

      expect(translatedCount).toBeGreaterThan(0)
    })
  })
})
