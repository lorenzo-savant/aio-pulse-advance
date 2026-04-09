'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Shield, ArrowLeft, Loader2, Mail } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { forgotPasswordSchema } from '@/lib/validations'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function ForgotPasswordPage() {
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
    <div className="relative flex min-h-screen flex-col bg-page-bg px-6">
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-30" />
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/15 blur-3xl" />

      <header className="relative z-10 flex items-center justify-between py-5">
        <Link
          href="/auth/login"
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
            <Link href="/auth/login">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 shadow-xl shadow-brand-600/30">
                <Shield className="h-6 w-6 text-white" />
              </div>
            </Link>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-nav-text-hover">
                Reset Password
              </h1>
              <p className="mt-1 text-sm text-nav-text">
                {sent
                  ? 'Check your email for the reset link'
                  : 'Enter your email to receive reset instructions'}
              </p>
            </div>
          </div>

          <div className="glass rounded-2xl p-8">
            {error && (
              <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {sent ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                  <Mail className="h-8 w-8 text-emerald-400" />
                </div>
                <p className="text-sm text-nav-text">
                  We sent a password reset link to{' '}
                  <strong className="text-nav-text-hover">{email}</strong>
                </p>
                <Link
                  href="/auth/login"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Sign In
                </Link>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
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

                <button
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loading}
                  type="submit"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>

                <p className="text-center text-sm text-auth-muted">
                  Remember your password?{' '}
                  <Link
                    className="font-semibold text-brand-600 hover:text-brand-700"
                    href="/auth/login"
                  >
                    Sign In
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
