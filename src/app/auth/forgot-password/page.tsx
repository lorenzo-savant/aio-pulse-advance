'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Mail } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { forgotPasswordSchema } from '@/lib/validations'
import { Reveal } from '@/components/Reveal'
import { Ornament } from '@/components/Ornament'
import { AioLogo } from '@/components/brand/Logo'
import { SiteHeader } from '@/components/SiteHeader'

export default function ForgotPasswordPage() {
  const t = useTranslations('auth_pages.forgot_password')
  const tHeader = useTranslations('site_header')
  const supabase = createSupabaseBrowserClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const parsed = forgotPasswordSchema.safeParse({ email })
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors).flat()[0]
      setError(firstError ?? 'Invalid input')
      return
    }

    setLoading(true)

    if (!supabase) {
      setError('Supabase not configured')
      setLoading(false)
      return
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      })

      if (resetError) {
        setError(resetError.message)
        return
      }

      setSent(true)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-30" />
      <div className="bg-primary/15 pointer-events-none absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-1/4 h-[240px] w-[240px] opacity-20">
        <Ornament variant="burst" />
      </div>

      <SiteHeader
        secondaryCta={null}
        primaryCta={{ label: tHeader('sign_in'), href: '/auth/login' }}
      />

      <div className="relative z-10 flex flex-1 items-center justify-center pb-12">
        <Reveal direction="scale" delay={1} className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <Link href="/auth/login" aria-label="AEO Pulse">
              <AioLogo size={48} markOnly />
            </Link>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">{t('title')}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {sent ? t('subtitle_sent') : t('subtitle_idle')}
              </p>
            </div>
          </div>

          <div className="glass rounded-2xl p-8">
            {error && (
              <div className="border-red-500/20 bg-red-500/10 text-red-400 mb-5 rounded-xl border px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {sent ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                  <Mail className="h-8 w-8 text-emerald-400" />
                </div>
                <p className="text-sm text-muted-foreground">{t('sent_body', { email })}</p>
                <Link
                  href="/auth/login"
                  className="hover:text-primary/80 mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary"
                >
                  <ArrowLeft className="h-4 w-4" /> {t('back_to_sign_in')}
                </Link>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t('email_label')}
                  </label>
                  <input
                    required
                    autoComplete="email"
                    className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
                    disabled={loading}
                    placeholder="you@company.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <button
                  className="shadow-primary/25 hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loading}
                  type="submit"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('sending')}
                    </>
                  ) : (
                    t('send')
                  )}
                </button>

                <p className="text-center text-sm text-muted-foreground">
                  {t('remember_password')}{' '}
                  <Link
                    className="hover:text-primary/80 font-semibold text-primary"
                    href="/auth/login"
                  >
                    {t('sign_in')}
                  </Link>
                </p>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  )
}
