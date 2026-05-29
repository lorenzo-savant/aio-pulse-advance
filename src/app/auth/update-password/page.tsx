'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Eye, EyeOff, Check, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { updatePasswordSchema } from '@/lib/validations'
import { AioLogo } from '@/components/brand/Logo'
import { SiteHeader } from '@/components/SiteHeader'

export default function UpdatePasswordPage() {
  const t = useTranslations('auth_update_password')
  const tHeader = useTranslations('site_header')
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const passwordStrength = (() => {
    if (!password) return { score: 0, label: '', color: '' }
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[a-z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++

    if (score <= 2) return { score, label: t('strength_weak'), color: 'bg-red-500' }
    if (score <= 3) return { score, label: t('strength_fair'), color: 'bg-yellow-500' }
    if (score <= 4) return { score, label: t('strength_good'), color: 'bg-blue-500' }
    return { score, label: t('strength_strong'), color: 'bg-emerald-500' }
  })()

  const passwordsMatch = password === confirmPassword && password.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const parsed = updatePasswordSchema.safeParse({ password, confirmPassword })
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
      const { error: updateError } = await supabase.auth.updateUser({
        password: parsed.data.password,
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/auth/login')
      }, 2000)
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="absolute inset-0 bg-background">
        <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-40" />
        <div className="bg-primary/20 absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full blur-[120px]" />
        <div className="bg-primary/10 absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full blur-[100px]" />
      </div>

      <SiteHeader
        secondaryCta={null}
        primaryCta={{ label: tHeader('sign_in'), href: '/auth/login' }}
      />

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <Link href="/auth/login" aria-label="AEO Pulse">
              <AioLogo size={48} markOnly />
            </Link>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">{t('title')}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
            </div>
          </div>

          <div className="glass rounded-2xl p-8">
            {error && (
              <div className="border-red-500/20 bg-red-500/10 text-red-400 mb-5 rounded-xl border px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {success ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                  <Check className="h-8 w-8 text-emerald-400" />
                </div>
                <p className="text-sm font-semibold text-foreground">{t('success_title')}</p>
                <p className="text-xs text-muted-foreground">{t('success_body')}</p>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t('new_password_label')}
                  </label>
                  <div className="relative">
                    <input
                      required
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-input bg-input px-4 py-3 pr-11 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
                      disabled={loading}
                      placeholder={t('new_password_placeholder')}
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setShowPw((v) => !v)}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-2 space-y-1">
                      <div className="mb-1 flex h-1 gap-1">
                        {[1, 2, 3, 4, 5].map((step) => (
                          <div
                            key={`strength-${step}`}
                            className={`h-full flex-1 rounded-full transition-colors ${
                              step <= passwordStrength.score ? passwordStrength.color : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">{passwordStrength.label}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t('confirm_password_label')}
                  </label>
                  <input
                    required
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
                    disabled={loading}
                    placeholder={t('confirm_password_placeholder')}
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  {confirmPassword && (
                    <p
                      className={`mt-1 flex items-center gap-1 text-xs ${passwordsMatch ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      {passwordsMatch ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {passwordsMatch ? t('passwords_match') : t('passwords_no_match')}
                    </p>
                  )}
                </div>

                <button
                  className="shadow-primary/25 hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loading || !passwordsMatch}
                  type="submit"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('updating')}
                    </>
                  ) : (
                    t('update_button')
                  )}
                </button>

                <p className="text-center text-sm text-muted-foreground">
                  <Link
                    className="hover:text-primary/80 font-semibold text-primary"
                    href="/auth/login"
                  >
                    <ArrowLeft className="mr-1 inline h-4 w-4" /> {t('back_to_sign_in')}
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
