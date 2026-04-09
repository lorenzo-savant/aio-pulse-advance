'use client'

import { Suspense, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Shield, Eye, EyeOff, Loader2, Mail, Zap, ArrowRight } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { loginSchema } from '@/lib/validations'
import { ThemeToggle } from '@/components/ThemeToggle'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createSupabaseBrowserClient()
  const emailParam = searchParams.get('email') || ''
  const confirmed = searchParams.get('confirmed') === 'true'

  const [email, setEmail] = useState(emailParam)
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
      <div className="absolute inset-0 bg-page-bg">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-[0.05]" />
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-brand-500/10 blur-[100px]" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/30">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tight text-text-on-surface">{APP_NAME}</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/auth/register"
            className="flex items-center gap-2 rounded-xl bg-surface-input px-4 py-2 text-sm font-medium text-text-on-surface transition-all hover:bg-surface-input-border"
          >
            Create account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-surface-input-border bg-auth-card p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-black text-text-on-surface">Welcome back</h1>
              <p className="mt-2 text-sm text-text-muted-surface">
                Sign in to your account to continue
              </p>
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
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/20">
                  <Shield className="h-4 w-4 text-red-400" />
                </div>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {magicLinkSent ? (
              <div className="space-y-6">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                    <Mail className="h-8 w-8 text-emerald-400" />
                  </div>
                  <h2 className="text-lg font-bold text-text-on-surface">Check your email</h2>
                  <p className="mt-2 text-sm text-text-muted-surface">
                    We sent a magic link to{' '}
                    <span className="font-medium text-text-on-surface">{email}</span>
                  </p>
                  <p className="mt-1 text-xs text-text-muted-surface">
                    Click the link to sign in. The link expires in 1 hour.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setMagicLinkSent(false)
                    setError(null)
                  }}
                  className="w-full rounded-xl border border-surface-input-border bg-surface-input py-3 text-sm font-medium text-text-on-surface transition-all hover:bg-surface-input-border"
                >
                  Use a different login method
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6 flex rounded-xl bg-surface-input p-1">
                  <button
                    type="button"
                    onClick={() => setLoginMode('password')}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                      loginMode === 'password'
                        ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                        : 'text-text-muted-surface hover:text-text-on-surface'
                    }`}
                  >
                    Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMode('magic')}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                      loginMode === 'magic'
                        ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                        : 'text-text-muted-surface hover:text-text-on-surface'
                    }`}
                  >
                    Magic Link
                  </button>
                </div>

                {loginMode === 'password' ? (
                  <form className="space-y-5" onSubmit={handlePasswordSubmit}>
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-text-muted-surface">
                        Email
                      </label>
                      <input
                        required
                        autoComplete="email"
                        className="w-full rounded-xl border border-surface-input-border bg-surface-input px-4 py-3 text-sm text-text-on-surface placeholder-text-muted-surface outline-none transition-all focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                        disabled={loading}
                        placeholder="you@company.com"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-text-muted-surface">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          required
                          autoComplete="current-password"
                          className="w-full rounded-xl border border-surface-input-border bg-surface-input px-4 py-3 pr-11 text-sm text-text-on-surface placeholder-text-muted-surface outline-none transition-all focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
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
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted-surface transition-colors hover:text-text-on-surface"
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
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted-surface">
                        <input
                          checked={rememberMe}
                          className="rounded border-surface-input-border bg-surface-input"
                          type="checkbox"
                          onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        Remember me
                      </label>
                      <Link
                        className="text-brand text-sm font-medium transition-colors hover:text-brand-400"
                        href="/auth/forgot-password"
                      >
                        Forgot password?
                      </Link>
                    </div>

                    <button
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition-all hover:from-brand-500 hover:to-brand-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={loading}
                      type="submit"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Signing in…
                        </>
                      ) : (
                        <>
                          Sign in
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form className="space-y-5" onSubmit={handleMagicLinkSubmit}>
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-text-muted-surface">
                        Email
                      </label>
                      <input
                        required
                        autoComplete="email"
                        className="w-full rounded-xl border border-surface-input-border bg-surface-input px-4 py-3 text-sm text-text-on-surface placeholder-text-muted-surface outline-none transition-all focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                        disabled={loading}
                        placeholder="you@company.com"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>

                    <p className="text-xs text-text-muted-surface">
                      We&apos;ll email you a magic link. Click it to sign in instantly — no password
                      needed.
                    </p>

                    <button
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition-all hover:from-brand-500 hover:to-brand-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={loading}
                      type="submit"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending link…
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4" />
                          Send Magic Link
                        </>
                      )}
                    </button>
                  </form>
                )}

                <p className="mt-8 text-center text-sm text-text-muted-surface">
                  Don&apos;t have an account?{' '}
                  <Link
                    className="text-brand font-semibold transition-colors hover:text-brand-400"
                    href="/auth/register"
                  >
                    Create one
                  </Link>
                </p>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-text-muted-surface">
            By continuing, you agree to our{' '}
            <Link className="text-brand hover:text-brand-400" href="#">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link className="text-brand hover:text-brand-400" href="#">
              Privacy Policy
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-page-bg">
          <Loader2 className="text-brand h-8 w-8 animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
