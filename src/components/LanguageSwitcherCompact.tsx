'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Check, ChevronDown, Globe } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { locales, localeLabels, type Locale } from '@/i18n/config'
import { cn } from '@/lib/utils'

const SHORT: Record<Locale, string> = {
  en: 'EN',
  it: 'IT',
  sv: 'SV',
}

/**
 * Compact language switcher for the site header. Differs from the sidebar
 * variant in that it renders a small pill (flag + locale code) with a
 * dropdown — fits next to the theme toggle without dominating the chrome.
 */
export function LanguageSwitcherCompact({ ariaLabel }: { ariaLabel?: string }) {
  const currentLocale = useLocale() as Locale
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const change = async (next: Locale) => {
    if (next === currentLocale) {
      setOpen(false)
      return
    }
    setSaving(true)
    try {
      const supabase = createSupabaseBrowserClient()
      if (supabase) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          await supabase.auth.updateUser({ data: { ui_language: next } })
        }
      }
      document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
      router.refresh()
    } finally {
      setSaving(false)
      setOpen(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        aria-label={ariaLabel ?? 'Change language'}
        className="hover:bg-muted/60 flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <Globe className="h-3.5 w-3.5" />
        {SHORT[currentLocale]}
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {locales.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => change(l)}
              className={cn(
                'hover:bg-muted/60 flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors',
                l === currentLocale && 'font-semibold text-foreground',
              )}
            >
              <span className="flex-1 text-left">{localeLabels[l]}</span>
              {l === currentLocale && <Check className="h-3.5 w-3.5 text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
