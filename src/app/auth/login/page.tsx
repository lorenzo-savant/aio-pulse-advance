'use client'

import { Suspense, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Shield, Eye, EyeOff, Loader2, Mail, Zap, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { APP_NAME } from '@/lib/constants'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { loginSchema } from '@/lib/validations'
import { Reveal } from '@/components/Reveal'
import { Ornament } from '@/components/Ornament'
import { SiteHeader } from '@/components/SiteHeader'

function LoginForm() {
  const t = useTranslations('auth_pages.login')
  const tHeader = useTranslations('site_header')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createSupabaseBrowserClient()
  const emailParam = searchParams.get('email') || ''
  const confirmed = searchParams.get('confirmed') === 'true'

  const isDev = process.env.NODE_ENV === 'development'

  // No demo credentials are read on the client. The previous NEXT_PUBLIC_DEMO_*
  // auto-fill inlined the demo password into the shipped JS bundle (visible to
  // anyone, and a footgun if those vars were ever set in a prod environment).
  // Dev sign-in now goes solely through the server-only "Developer Bypass"
  // button below → POST /api/auth/dev-login, which reads DEMO_EMAIL /
  // DEMO_PASSWORD server-side (never exposed to the browser).
  const defaultEmail = emailParam || ''

  const [email, setEmail] = useState(defaultEmail)
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [loginMode, setLoginMode] = useState<'password' | 'magic'>('password')
  const [successMessage] = useState<string | null>(
    confirmed ? 'Email confirmed! Please sign in.' : null,
  )

  async function handleDevBypass() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/dev-login', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to bypass auth')
        setLoading(false)
        return
      }

      router.push(data.redirectTo || '/dashboard')
      router.refresh()
    } catch (err) {
      console.error('[dev-bypass] Error:', err)
      setError('Failed to bypass auth')
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      const firstError = parsed.error.flatten().fieldErrors
      const msg = Object.values(firstError).flat()[0] ?? 'Invalid input'
      setError(msg)
      return
    }

    setLoading(true)

    if (!supabase) {
      router.push('/dashboard')
      router.refresh()
      return
    }

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      })

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          setError('Incorrect email or password. Please try again.')
        } else if (authError.message.includes('Email not confirmed')) {
          setError('Please verify your email address before signing in.')
        } else {
          setError(authError.message)
        }
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      console.error('[login] Unexpected error:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleMagicLinkSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }

    setLoading(true)

    if (!supabase) {
      setError('Supabase not configured')
      setLoading(false)
      return
    }

    try {
      const { error: magicError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?type=magiclink`,
        },
      })

      if (magicError) {
        setError(magicError.message)
        return
      }

      setMagicLinkSent(true)
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
        <div className="pointer-events-none absolute -left-24 top-1/3 h-[280px] w-[280px] opacity-25">
          <Ornament variant="orbit" />
        </div>
        <div className="pointer-events-none absolute -right-20 bottom-12 h-[220px] w-[220px] opacity-20">
          <Ornament variant="blob" />
        </div>
      </div>

      <SiteHeader
        secondaryCta={null}
        primaryCta={{ label: tHeader('create_account'), href: '/auth/register' }}
      />

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <Reveal direction="scale" delay={1} className="w-full max-w-md">
          <div className="rounded-2xl border border-input bg-card p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-black text-foreground">{t('title')}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t('subtitle')}</p>
            </div>

            {successMessage && (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
                  <Mail className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="text-sm text-emerald-400">{successMessage}</p>
              </div>
            )}
            {error && (
              <div className="border-red-500/20 bg-red-500/10 mb-6 flex items-center gap-3 rounded-xl border p-4">
                <div className="bg-red-500/20 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <Shield className="text-red-400 h-4 w-4" />
                </div>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {isDev && !magicLinkSent && (
              <button
                type="button"
                onClick={handleDevBypass}
                disabled={loading}
                className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 py-3 text-sm font-semibold text-amber-400 transition-all hover:bg-amber-500/20 active:scale-[0.98] disabled:opacity-60"
              >
                <Zap className="h-4 w-4" />
                Developer Bypass — Skip Login
              </button>
            )}

            {magicLinkSent ? (
              <div className="space-y-6">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                    <Mail className="h-8 w-8 text-emerald-400" />
                  </div>
                  <h2 className="text-lg font-bold text-foreground">{t('check_email_title')}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('check_email_body', { email })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('check_email_hint')}</p>
                </div>
                <button
                  onClick={() => {
                    setMagicLinkSent(false)
                    setError(null)
                  }}
                  className="hover:bg-accent/10 w-full rounded-xl border border-input bg-input py-3 text-sm font-medium text-foreground transition-all"
                >
                  {t('use_different_method')}
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6 flex rounded-xl bg-input p-1">
                  <button
                    type="button"
                    onClick={() => setLoginMode('password')}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                      loginMode === 'password'
                        ? 'shadow-primary/25 bg-primary text-primary-foreground shadow-lg'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t('password_tab')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMode('magic')}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                      loginMode === 'magic'
                        ? 'shadow-primary/25 bg-primary text-primary-foreground shadow-lg'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t('magic_link_tab')}
                  </button>
                </div>

                {loginMode === 'password' ? (
                  <form className="space-y-5" onSubmit={handlePasswordSubmit}>
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

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {t('password_label')}
                      </label>
                      <div className="relative">
                        <input
                          required
                          autoComplete="current-password"
                          className="w-full rounded-xl border border-input bg-input px-4 py-3 pr-11 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
                          disabled={loading}
                          placeholder="••••••••"
                          type={showPw ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          aria-label={showPw ? 'Hide password' : 'Show password'}
                          aria-pressed={showPw}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                          onClick={() => setShowPw((v) => !v)}
                        >
                          {showPw ? (
                            <EyeOff className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                        <input
                          checked={rememberMe}
                          className="rounded border-input bg-input"
                          type="checkbox"
                          onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        {t('remember_me')}
                      </label>
                      <Link
                        className="hover:text-primary/80 text-sm font-medium text-primary transition-colors"
                        href="/auth/forgot-password"
                      >
                        {t('forgot_password')}
                      </Link>
                    </div>

                    <button
                      className="to-primary/80 shadow-primary/25 hover:from-primary/90 hover:to-primary/70 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary py-3.5 text-sm font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={loading}
                      type="submit"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t('signing_in')}
                        </>
                      ) : (
                        <>
                          {t('sign_in')}
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form className="space-y-5" onSubmit={handleMagicLinkSubmit}>
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Email
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

                    <p className="text-xs text-muted-foreground">{t('magic_link_hint')}</p>

                    <button
                      className="to-primary/80 shadow-primary/25 hover:from-primary/90 hover:to-primary/70 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary py-3.5 text-sm font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={loading}
                      type="submit"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t('sending_link')}
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4" />
                          {t('send_magic_link')}
                        </>
                      )}
                    </button>
                  </form>
                )}

                <p className="mt-8 text-center text-sm text-muted-foreground">
                  {t('no_account')}{' '}
                  <Link
                    className="hover:text-primary/80 font-semibold text-primary transition-colors"
                    href="/auth/register"
                  >
                    {t('create_one')}
                  </Link>
                </p>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {t('terms_prefix')}{' '}
            <Link className="hover:text-primary/80 text-primary" href="/trust">
              {t('terms')}
            </Link>{' '}
            {t('and')}{' '}
            <Link className="hover:text-primary/80 text-primary" href="/trust/gdpr">
              {t('privacy')}
            </Link>
          </p>
        </Reveal>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
