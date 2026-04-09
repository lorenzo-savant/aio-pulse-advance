'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Shield, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createSupabaseBrowserClient()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Verifying your account...')

  useEffect(() => {
    const handleCallback = async () => {
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')
      const email = searchParams.get('email')

      if (!supabase) {
        setStatus('error')
        setMessage('Supabase not configured')
        return
      }

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          email: email || '',
          token: tokenHash,
          type: type as 'email_change' | 'recovery' | 'signup' | 'magiclink',
        })

        if (error) {
          setStatus('error')
          setMessage(error.message)
          return
        }

        if (type === 'recovery') {
          setStatus('success')
          setMessage('Password reset verified! Redirecting...')
          setTimeout(() => router.push('/auth/update-password'), 1500)
        } else if (type === 'signup') {
          setStatus('success')
          setMessage('Email confirmed! Please sign in with your password.')
          setTimeout(
            () =>
              router.push(`/auth/login?confirmed=true&email=${encodeURIComponent(email || '')}`),
            1500,
          )
        } else if (type === 'magiclink') {
          setStatus('success')
          setMessage('Signed in successfully! Redirecting...')
          setTimeout(() => router.push('/dashboard'), 1500)
        } else if (type === 'email_change') {
          setStatus('success')
          setMessage('Email updated successfully!')
          setTimeout(() => router.push('/dashboard/settings'), 1500)
        }
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session) {
          setStatus('success')
          setMessage('Signed in successfully! Redirecting...')
          setTimeout(() => router.push('/dashboard'), 1500)
        } else {
          setStatus('error')
          setMessage('Invalid or expired link. Please try again.')
        }
      }
    }

    handleCallback()
  }, [searchParams, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 px-6">
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-30" />
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/15 blur-3xl" />

      <div className="animate-in relative z-10 w-full max-w-sm text-center">
        <div className="mb-8 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 shadow-xl shadow-brand-600/30">
            <Shield className="h-6 w-6 text-white" />
          </div>
        </div>

        <div className="glass rounded-2xl p-8">
          {status === 'loading' && (
            <>
              <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-brand-400" />
              <h2 className="mb-2 text-xl font-bold text-white">Verifying</h2>
              <p className="text-sm text-gray-400">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="mb-2 text-xl font-bold text-white">Success!</h2>
              <p className="text-sm text-gray-400">{message}</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <XCircle className="h-8 w-8 text-red-400" />
              </div>
              <h2 className="mb-2 text-xl font-bold text-white">Error</h2>
              <p className="mb-4 text-sm text-gray-400">{message}</p>
              <a
                href="/auth/login"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-brand-500"
              >
                Back to Login
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface-950">
          <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
