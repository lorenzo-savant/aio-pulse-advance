import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { createServerClient } from '@/lib/supabase'
import { defaultLocale, locales, type Locale } from './config'

function pickFromAcceptLanguage(header: string | null): Locale {
  if (!header) return defaultLocale
  const primary = header.split(',')[0]?.split('-')[0]?.trim().toLowerCase()
  return (locales as readonly string[]).includes(primary ?? '')
    ? (primary as Locale)
    : defaultLocale
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const headerStore = await headers()

  let locale: Locale = defaultLocale

  try {
    const db = createServerClient()
    if (db) {
      const {
        data: { user },
      } = await db.auth.getUser()
      const userLocale = user?.user_metadata?.ui_language
      if (userLocale && (locales as readonly string[]).includes(userLocale)) {
        locale = userLocale
      }
    }
  } catch {
    // fall through
  }

  if (locale === defaultLocale) {
    const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value
    if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
      locale = cookieLocale as Locale
    }
  }

  if (locale === defaultLocale) {
    locale = pickFromAcceptLanguage(headerStore.get('accept-language'))
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  }
})
