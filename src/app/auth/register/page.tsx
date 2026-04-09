// PATH: src/app/auth/register/page.tsx
'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { Shield, Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { registerSchema } from '@/lib/validations'
import { ThemeToggle } from '@/components/ThemeToggle'

import { useRouter } from 'next/navigation'

function PasswordRequirement({ label, met }: { label: string; met: boolean }) {
  return (
    <p className={`text-xs ${met ? 'text-emerald-500' : 'text-auth-muted'}`}>
      {met ? <CheckCircle2 className="mr-1 inline h-3 w-3" /> : '○'} {label}
    </p>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const parsed = registerSchema.safeParse({ name, email, password, confirmPassword })
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors).flat()[0]
      setError(firstError ?? 'Invalid input')
      return
    }

    setLoading(true)

    if (!supabase) {
      router.push('/dashboard')
      router.refresh()
      return
    }

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: { name: parsed.data.name },
          emailRedirectTo: `${window.location.origin}/auth/callback?type=signup`,
        },
      })

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('This email is already registered. Try signing in instead.')
        } else {
          setError(signUpError.message)
        }
        return
      }

      setSuccess(true)
    } catch (err) {
      console.error('[register] Unexpected error:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page-bg px-6">
        <div className="w-full max-w-sm text-center">
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-emerald-500" />
          <h1 className="mb-2 text-2xl font-black text-nav-text-hover">Check your inbox</h1>
          <p className="mb-6 text-sm text-nav-text">
            We sent a verification link to <strong className="text-nav-text-hover">{email}</strong>.
            Click the link to activate your account.
          </p>
          <Link
            className="inline-block rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-brand-500"
            href="/auth/login"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-page-bg px-6">
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-30" />
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/15 blur-3xl" />

      <header className="relative z-10 flex items-center justify-between py-5">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-text-muted-surface hover:text-text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <ThemeToggle />
      </header>

      <div className="animate-in relative z-10 flex flex-1 items-center justify-center pb-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 shadow-xl shadow-brand-600/30">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-nav-text-hover">{APP_NAME}</h1>
              <p className="mt-1 text-sm text-nav-text">Create your account</p>
            </div>
          </div>

          <div className="glass rounded-2xl p-8">
            {error && (
              <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-auth-label">
                  Full Name
                </label>
                <input
                  required
                  autoComplete="name"
                  className="w-full rounded-xl border border-auth-input-border bg-auth-input px-4 py-3 text-sm text-auth-input-text placeholder-auth-muted outline-none transition-all focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  disabled={loading}
                  placeholder="Your Name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-auth-label">
                  Email
                </label>
                <input
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-auth-input-border bg-auth-input px-4 py-3 text-sm text-auth-input-text placeholder-auth-muted outline-none transition-all focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  disabled={loading}
                  placeholder="you@company.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-auth-label">
                  Password
                </label>
                <div className="relative">
                  <input
                    required
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-auth-input-border bg-auth-input px-4 py-3 pr-11 text-sm text-auth-input-text placeholder-auth-muted outline-none transition-all focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    disabled={loading}
                    minLength={8}
                    placeholder="Min. 8 characters"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-auth-muted transition-colors hover:text-auth-label"
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    aria-pressed={showPw}
                  >
                    {showPw ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>

                <div className="mt-2 space-y-1">
                  <PasswordRequirement label="At least 8 characters" met={password.length >= 8} />
                  <PasswordRequirement label="One uppercase letter" met={/[A-Z]/.test(password)} />
                  <PasswordRequirement label="One lowercase letter" met={/[a-z]/.test(password)} />
                  <PasswordRequirement label="One number" met={/[0-9]/.test(password)} />
                  <PasswordRequirement
                    label="One special character"
                    met={/[^A-Za-z0-9]/.test(password)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-auth-label">
                  Confirm Password
                </label>
                <input
                  required
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-auth-input-border bg-auth-input px-4 py-3 text-sm text-auth-input-text placeholder-auth-muted outline-none transition-all focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  disabled={loading}
                  placeholder="••••••••"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <button
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
                type="submit"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-auth-muted">
              Already have an account?{' '}
              <Link
                className="font-semibold text-brand-600 hover:text-brand-700"
                href="/auth/login"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
