export const locales = ['en', 'it', 'sv'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'sv'

export const localeLabels: Record<Locale, string> = {
  en: '🇬🇧 English',
  it: '🇮🇹 Italiano',
  sv: '🇸🇪 Svenska',
}
