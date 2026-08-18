// PATH: src/content/docs/index.ts
//
// Locale resolver for the in-app documentation. Both /docs (public) and
// /dashboard/docs (in-app) read through here, so the two pages can never drift
// apart in content — only in chrome.

import { defaultLocale, locales, type Locale } from '@/i18n/config'
import { docsEn } from './en'
import { docsIt } from './it'
import { docsSv } from './sv'
import type { DocContent } from './types'

export const DOC_CONTENT: Record<Locale, DocContent> = {
  en: docsEn,
  it: docsIt,
  sv: docsSv,
}

/**
 * Content for a locale, falling back to the default locale (sv) for anything
 * unrecognised. Takes a plain string because `useLocale()` is typed as string.
 */
export function getDocContent(locale: string): DocContent {
  return (locales as readonly string[]).includes(locale)
    ? (DOC_CONTENT[locale as Locale] ?? DOC_CONTENT[defaultLocale])
    : DOC_CONTENT[defaultLocale]
}

export type { DocContent, DocGroup, DocSection, DocIconKey } from './types'
