'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { ThemeToggle } from '@/components/ThemeToggle'
import { HomeContent } from './HomeContent'

function AcceptContent() {
  const t = useTranslations('team_accept')
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState(t('accepting_message'))

  useEffect(() => {
    if (!token && typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('pending_invite_token')
      if (saved) {
        sessionStorage.removeItem('pending_invite_token')
        router.replace(`/team/accept?token=${saved}`)
      }
    }
  }, [token, router])

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage(t('invalid_token'))
      return
    }

    async function acceptInvitation() {
      const supabase = createSupabaseBrowserClient()
      if (!supabase) {
        setStatus('error')
        setMessage(t('init_failed'))
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('pending_invite_token', token || '')
        }
        const loginUrl = `/auth/login?redirect=${encodeURIComponent(`/team/accept?token=${token}`)}`
        router.push(loginUrl)
        return
      }

      try {
        const res = await fetch('/api/invitations/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        const data = await res.json()

        if (data.success) {
          setStatus('success')
          setMessage(data.message)
        } else {
          setStatus('error')
          setMessage(data.message || t('accept_failed'))
        }
      } catch (err) {
        setStatus('error')
        setMessage(t('generic_error'))
      }
    }

    acceptInvitation()
    // router is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md border border-input bg-card p-8">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-accent" />
              <h2 className="mt-4 text-xl font-bold text-foreground">{t('accepting_title')}</h2>
              <p className="mt-2 text-muted-foreground">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
              <h2 className="mt-4 text-xl font-bold text-foreground">{t('success_title')}</h2>
              <p className="mt-2 text-muted-foreground">{message}</p>
              <Button onClick={() => router.push('/dashboard')} className="mt-6">
                {t('go_to_dashboard')} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="text-red-400 mx-auto h-12 w-12" />
              <h2 className="mt-4 text-xl font-bold text-foreground">{t('error_title')}</h2>
              <p className="mt-2 text-muted-foreground">{message}</p>
              <div className="mt-6 flex justify-center gap-3">
                <Button variant="outline" onClick={() => router.push('/login')}>
                  {t('sign_in')}
                </Button>
                <Button onClick={() => router.push('/')}>{t('go_to_homepage')}</Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}

function HomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  if (token) {
    return (
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        }
      >
        <AcceptContent />
      </Suspense>
    )
  }

  return <HomeContent />
}

export default function HomePageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      }
    >
      <HomePage />
    </Suspense>
  )
}
