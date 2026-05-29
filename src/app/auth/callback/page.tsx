'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { AioLogo } from '@/components/brand/Logo'

function AuthCallbackContent() {
  const t = useTranslations('auth_callback')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createSupabaseBrowserClient()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState(t('verifying'))

  useEffect(() => {
    const handleCallback = async () => {
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')
      const email = searchParams.get('email')

      if (!supabase) {
        setStatus('error')
        setMessage(t('not_configured'))
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
          setMessage(t('recovery_success'))
          setTimeout(() => router.push('/auth/update-password'), 1500)
        } else if (type === 'signup') {
          setStatus('success')
          setMessage(t('signup_success'))
          setTimeout(
            () =>
              router.push(`/auth/login?confirmed=true&email=${encodeURIComponent(email || '')}`),
            1500,
          )
        } else if (type === 'magiclink') {
          setStatus('success')
          setMessage(t('magiclink_success'))
          setTimeout(() => router.push('/dashboard'), 1500)
        } else if (type === 'email_change') {
          setStatus('success')
          setMessage(t('email_change_success'))
          setTimeout(() => router.push('/dashboard/settings'), 1500)
        }
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session) {
          setStatus('success')
          setMessage(t('session_success'))
          setTimeout(() => router.push('/dashboard'), 1500)
        } else {
          setStatus('error')
          setMessage(t('invalid_link'))
        }
      }
    }

    handleCallback()
    // supabase client is stable across renders; including it would force
    // a needless re-run on each render without changing behaviour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router])

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-6">
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-30" />
      <div className="bg-primary/15 pointer-events-none absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-sm text-center">
        <div className="mb-8 flex justify-center">
          <AioLogo size={48} markOnly />
        </div>

        <div className="glass rounded-2xl p-8">
          {status === 'loading' && (
            <>
              <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
              <h2 className="mb-2 text-xl font-bold text-foreground">{t('verifying_title')}</h2>
              <p className="text-sm text-muted-foreground">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="mb-2 text-xl font-bold text-foreground">{t('success_title')}</h2>
              <p className="text-sm text-muted-foreground">{message}</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="bg-red-500/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                <XCircle className="text-red-400 h-8 w-8" />
              </div>
              <h2 className="mb-2 text-xl font-bold text-foreground">{t('error_title')}</h2>
              <p className="mb-4 text-sm text-muted-foreground">{message}</p>
              <a
                href="/auth/login"
                className="hover:bg-primary/90 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-all"
              >
                {t('back_to_login')}
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
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
