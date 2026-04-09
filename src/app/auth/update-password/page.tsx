'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shield, ArrowLeft, Loader2, Eye, EyeOff, Check, X } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { updatePasswordSchema } from '@/lib/validations'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function UpdatePasswordPage() {
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

    if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' }
    if (score <= 3) return { score, label: 'Fair', color: 'bg-yellow-500' }
    if (score <= 4) return { score, label: 'Good', color: 'bg-blue-500' }
    return { score, label: 'Strong', color: 'bg-emerald-500' }
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
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-[0.05]" />
        <div className="bg-accent/20 absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full blur-[120px]" />
        <div className="bg-accent/10 absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full blur-[100px]" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Link
          href="/auth/login"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <Link href="/auth/login">
              <div className="shadow-primary/30 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-xl">
                <Shield className="h-6 w-6 text-white" />
              </div>
            </Link>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">New Password</h1>
              <p className="mt-1 text-sm text-muted-foreground">Enter your new password below</p>
            </div>
          </div>

          <div className="glass rounded-2xl p-8">
            {error && (
              <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {success ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                  <Check className="h-8 w-8 text-emerald-400" />
                </div>
                <p className="text-sm text-muted-foreground">Password updated successfully!</p>
                <p className="text-xs text-muted-foreground">Redirecting to login...</p>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      required
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-input bg-input px-4 py-3 pr-11 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent"
                      disabled={loading}
                      placeholder="••••••••"
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
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">{passwordStrength.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {password.length >= 8 &&
                          /[A-Z]/.test(password) &&
                          /[a-z]/.test(password) &&
                          /[0-9]/.test(password) &&
                          /[^A-Za-z0-9]/.test(password)
                            ? 'Meets requirements'
                            : 'Missing requirements'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Confirm Password
                  </label>
                  <input
                    required
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent"
                    disabled={loading}
                    placeholder="••••••••"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  {confirmPassword && (
                    <p
                      className={`mt-1 flex items-center gap-1 text-xs ${passwordsMatch ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      {passwordsMatch ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
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
                      Updating...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </button>

                <p className="text-center text-sm text-muted-foreground">
                  <Link
                    className="hover:text-accent/80 font-semibold text-accent"
                    href="/auth/login"
                  >
                    <ArrowLeft className="mr-1 inline h-4 w-4" /> Back to Sign In
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
