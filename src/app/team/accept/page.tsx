'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { ThemeToggle } from '@/components/ThemeToggle'

function AcceptContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Accepting invitation...')

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
      setMessage('Invalid invitation link. No token provided.')
      return
    }

    async function acceptInvitation() {
      const supabase = createSupabaseBrowserClient()
      if (!supabase) {
        setStatus('error')
        setMessage('Unable to initialize. Please refresh the page.')
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

        // Whether the call succeeded or failed, the token has now been
        // consumed (or attempted). Strip it from the URL via history
        // replaceState so it doesn't survive in browser history, doesn't
        // leak via Referer to external resources, and isn't sync'd across
        // devices via browser sync.
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', '/team/accept')
        }

        if (data.success) {
          setStatus('success')
          setMessage(data.message)
        } else {
          setStatus('error')
          setMessage(data.message || 'Failed to accept invitation')
        }
      } catch (err) {
        setStatus('error')
        setMessage('An error occurred while accepting the invitation')
      }
    }

    acceptInvitation()
    // router is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <div className="bg-page-bg relative flex min-h-screen items-center justify-center p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="border-surface-input-border w-full max-w-md border bg-card p-8">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="text-brand-400 mx-auto h-12 w-12 animate-spin" />
              <h2 className="text-text-on-surface mt-4 text-xl font-bold">Accepting Invitation</h2>
              <p className="text-text-muted-surface mt-2">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
              <h2 className="text-text-on-surface mt-4 text-xl font-bold">Welcome!</h2>
              <p className="text-text-muted-surface mt-2">{message}</p>
              <Button onClick={() => router.push('/dashboard')} className="mt-6">
                Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="mx-auto h-12 w-12 text-red-400" />
              <h2 className="text-text-on-surface mt-4 text-xl font-bold">Unable to Accept</h2>
              <p className="text-text-muted-surface mt-2">{message}</p>
              <div className="mt-6 flex justify-center gap-3">
                <Button variant="outline" onClick={() => router.push('/login')}>
                  Sign In
                </Button>
                <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-page-bg flex min-h-screen items-center justify-center">
          <Loader2 className="text-brand-400 h-8 w-8 animate-spin" />
        </div>
      }
    >
      <AcceptContent />
    </Suspense>
  )
}
