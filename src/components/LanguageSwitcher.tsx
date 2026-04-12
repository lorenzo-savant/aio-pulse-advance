'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Globe } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { locales, localeLabels, type Locale } from '@/i18n/config'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

export function LanguageSwitcher() {
  const currentLocale = useLocale() as Locale
  const router = useRouter()
  const t = useTranslations('sidebar.language_switcher')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

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
          await supabase.auth.updateUser({
            data: { ui_language: next },
          })
        }
      }
      document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
      toast.success(t('applied'))
      router.refresh()
    } catch {
      toast.error('Failed to change language')
    } finally {
      setSaving(false)
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary"
      >
        <Globe className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">{localeLabels[currentLocale]}</span>
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-full rounded-lg border border-border bg-card shadow-lg">
          {locales.map((l) => (
            <button
              key={l}
              onClick={() => change(l)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-secondary',
                l === currentLocale && 'bg-secondary font-bold',
              )}
            >
              <span className="flex-1 text-left">{localeLabels[l]}</span>
              {l === currentLocale && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
