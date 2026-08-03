'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, Loader2, ArrowRight, Mail } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { ThemeToggle } from '@/components/ThemeToggle'
import { savePendingInvite, takePendingInvite, hasPendingInvite } from '@/lib/pending-invite'

function AcceptContent() {
  const t = useTranslations('team_accept')
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'needs-auth'>('loading')
  const [message, setMessage] = useState(t('accepting_message'))

  // Context for the signed-out landing screen. Without this an invitee who has
  // no account is bounced to a sign-in form with no clue which address to use
  // — the dead end that left every invitation unaccepted.
  // Set when the refusal was "you are signed in as the wrong account" — the
  // only failure the visitor can resolve themselves.
  const [wrongAccount, setWrongAccount] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const [invite, setInvite] = useState<{
    brandName: string | null
    maskedEmail: string
    role: string
    usable: boolean
    expired: boolean
    alreadyUsed: boolean
  } | null>(null)

  useEffect(() => {
    if (!token && typeof window !== 'undefined') {
      const saved = takePendingInvite()
      if (saved) {
        router.replace(`/team/accept?token=${encodeURIComponent(saved)}`)
      }
    }
  }, [token, router])

  // Guards against the effect re-running after the token is stripped from the
  // URL below. Next patches window.history.replaceState so external history
  // changes flow back into useSearchParams — so the strip flips `token` to
  // null, re-runs this effect, and the `!token` branch overwrites the real
  // outcome with "Invalid invitation link. No token provided." The invite was
  // accepted; only the UI reported failure.
  const outcomeSettled = useRef(false)

  useEffect(() => {
    if (outcomeSettled.current) return

    if (!token) {
      // A stashed token is about to be restored by the effect above — stay on
      // the loading state instead of flashing a red error for one frame.
      if (hasPendingInvite()) return
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
        // Do NOT bounce straight to sign-in. An invitee may have no account at
        // all, and a login form gives them nowhere to go. Stash the token, then
        // show both doors — sign in, or create the account — with the invited
        // address on screen so they know which one to use.
        savePendingInvite(token || '')
        outcomeSettled.current = true
        try {
          const res = await fetch(`/api/invitations/preview?token=${encodeURIComponent(token!)}`)
          const data = await res.json()
          if (data.success) setInvite(data.data)
        } catch {
          // Preview is decoration; the two buttons still work without it.
        }
        setStatus('needs-auth')
        return
      }

      try {
        const res = await fetch('/api/invitations/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        const data = await res.json()

        // Settle BEFORE stripping the URL — the strip re-triggers this effect.
        outcomeSettled.current = true

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
          // Signed in with the wrong account — by far the most common refusal,
          // and the one the visitor can actually fix. Keep the token so the
          // flow can resume after they switch accounts, and offer the switch
          // instead of leaving them to work it out.
          if (data.error === 'EMAIL_MISMATCH') {
            savePendingInvite(token!)
            setWrongAccount(true)
          }
          setStatus('error')
          setMessage(data.message || 'Failed to accept invitation')
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

  // Sign out, then land back on /team/accept with no token in the URL. The
  // restore effect picks the stashed token out of localStorage and the
  // signed-out screen offers both doors — sign in, or create the account.
  async function handleSwitchAccount() {
    setSigningOut(true)
    try {
      const supabase = createSupabaseBrowserClient()
      await supabase?.auth.signOut()
    } catch {
      // Even if sign-out fails, sending them onward is better than a dead end.
    }
    // Full reload so no stale session state survives in memory.
    window.location.href = '/team/accept'
  }

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

          {status === 'needs-auth' && (
            <>
              <Mail className="mx-auto h-12 w-12 text-accent" />
              <h2 className="mt-4 text-xl font-bold text-foreground">
                {invite?.brandName
                  ? `You've been invited to ${invite.brandName}`
                  : "You've been invited to collaborate"}
              </h2>

              {invite && !invite.usable ? (
                <p className="mt-2 text-muted-foreground">
                  {invite.expired
                    ? 'This invitation has expired. Ask the workspace owner to send a new one.'
                    : 'This invitation has already been used.'}
                </p>
              ) : (
                <>
                  <p className="mt-2 text-muted-foreground">
                    {invite ? (
                      <>
                        It was issued for{' '}
                        <span className="font-semibold text-foreground">{invite.maskedEmail}</span>
                        {invite.role ? ` as ${invite.role}` : ''}. Use that address to continue — an
                        invitation only works for the account it was sent to.
                      </>
                    ) : (
                      'Sign in with the invited address, or create an account for it, to accept.'
                    )}
                  </p>

                  <div className="mt-6 flex flex-col gap-3">
                    <Button
                      onClick={() =>
                        router.push(
                          `/auth/register?redirect=${encodeURIComponent(`/team/accept?token=${token}`)}`,
                        )
                      }
                    >
                      Create an account <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        router.push(
                          `/auth/login?redirect=${encodeURIComponent(`/team/accept?token=${token}`)}`,
                        )
                      }
                    >
                      I already have an account
                    </Button>
                  </div>

                  <p className="mt-4 text-xs text-muted-foreground">
                    We&apos;ll bring you straight back here once you&apos;re signed in.
                  </p>
                </>
              )}
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

              {wrongAccount ? (
                <>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Sign out and continue with the invited address. If it has no account yet,
                    you&apos;ll be able to create one — the invitation is kept either way.
                  </p>
                  <div className="mt-6 flex flex-col gap-3">
                    <Button disabled={signingOut} onClick={handleSwitchAccount}>
                      {signingOut ? 'Signing out…' : 'Sign out and continue'}
                      {!signingOut && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                    <Button variant="outline" onClick={() => router.push('/dashboard')}>
                      {t('go_to_dashboard')}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="mt-6 flex justify-center gap-3">
                  <Button variant="outline" onClick={() => router.push('/auth/login')}>
                    {t('sign_in')}
                  </Button>
                  <Button onClick={() => router.push('/dashboard')}>{t('go_to_dashboard')}</Button>
                </div>
              )}
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
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      }
    >
      <AcceptContent />
    </Suspense>
  )
}
