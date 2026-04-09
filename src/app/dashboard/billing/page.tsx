// PATH: src/app/dashboard/billing/page.tsx
'use client'

import { useState, useEffect, Suspense } from 'react'
import {
  CreditCard,
  Check,
  Zap,
  Building2,
  Crown,
  ExternalLink,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useSearchParams } from 'next/navigation'

// Default export wraps in Suspense for useSearchParams
export default function BillingPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        </div>
      }
    >
      <BillingPage />
    </Suspense>
  )
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlanInfo {
  name: string
  price: number
  brands: number
  prompts: number
  scansPerDay: number
  features: string[]
  priceId?: string
}

interface BillingData {
  plan: string
  planInfo: PlanInfo
  status: string
  currentPeriodEnd: string | null
  stripeCustomerId: string | null
  allPlans: Record<string, PlanInfo>
}

// ─── Plan Icons ──────────────────────────────────────────────────────────────

const PLAN_ICONS: Record<string, typeof Zap> = {
  free: Zap,
  pro: Sparkles,
  business: Crown,
}

const PLAN_COLORS: Record<string, string> = {
  free: 'border-surface-input-border',
  pro: 'border-brand-500/50 bg-brand-500/5',
  business: 'border-amber-500/50 bg-amber-500/5',
}

// ─── Page ────────────────────────────────────────────────────────────────────

function BillingPage() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  // Check for success/cancel from Stripe
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Subscription activated! Welcome to your new plan.')
    }
    if (searchParams.get('canceled') === 'true') {
      toast('Checkout canceled', { icon: '👋' })
    }
  }, [searchParams])

  // Load billing data
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/billing')
        const d = await res.json()
        if (d.success) setData(d.data)
      } catch {
        console.error('Failed to load billing')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Checkout
  const handleCheckout = async (plan: string) => {
    setCheckoutLoading(plan)
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkout', plan }),
      })
      const d = await res.json()
      if (!d.success) throw new Error(d.message)
      window.location.href = d.data.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Checkout failed')
    } finally {
      setCheckoutLoading(null)
    }
  }

  // Manage subscription
  const handlePortal = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'portal' }),
      })
      const d = await res.json()
      if (!d.success) throw new Error(d.message)
      window.location.href = d.data.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open portal')
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    )
  }

  const currentPlan = data?.plan || 'free'
  const plans = data?.allPlans || {}

  return (
    <div className="space-y-6 bg-page-bg">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-brand-400" />
          <h1 className="text-3xl font-black tracking-tight text-white">Billing</h1>
        </div>
        <p className="mt-1 text-surface-400">Manage your subscription and billing details.</p>
      </div>

      {/* Current Plan Status */}
      <Card className="border-brand-500/20 bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600/20">
              {(() => {
                const Icon = PLAN_ICONS[currentPlan] || Zap
                return <Icon className="h-6 w-6 text-brand-400" />
              })()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-text-primary-ui text-lg font-black">
                  {data?.planInfo?.name || 'Free'} Plan
                </h2>
                <Badge variant={data?.status === 'active' ? 'success' : 'warning'}>
                  {data?.status || 'active'}
                </Badge>
              </div>
              {data?.currentPeriodEnd && (
                <p className="text-text-muted-ui text-xs">
                  Renews {new Date(data.currentPeriodEnd).toLocaleDateString('sv-SE')}
                </p>
              )}
            </div>
          </div>
          {currentPlan !== 'free' && (
            <Button variant="outline" loading={portalLoading} onClick={handlePortal}>
              <ExternalLink className="h-4 w-4" /> Manage Subscription
            </Button>
          )}
        </div>
      </Card>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {Object.entries(plans).map(([key, plan]) => {
          const isCurrentPlan = currentPlan === key
          const Icon = PLAN_ICONS[key] || Zap

          return (
            <Card
              key={key}
              className={cn(
                'relative border bg-card p-6',
                PLAN_COLORS[key],
                isCurrentPlan && 'ring-2 ring-brand-500',
              )}
            >
              {key === 'pro' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="brand">Most Popular</Badge>
                </div>
              )}

              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-input">
                  <Icon
                    className={cn(
                      'h-6 w-6',
                      key === 'business'
                        ? 'text-amber-400'
                        : key === 'pro'
                          ? 'text-brand-400'
                          : 'text-text-muted-ui',
                    )}
                  />
                </div>
                <h3 className="text-text-primary-ui text-lg font-black">{plan.name}</h3>
                <div className="mt-2 flex items-baseline justify-center gap-1">
                  <span className="text-text-primary-ui text-3xl font-black">${plan.price}</span>
                  {plan.price > 0 && <span className="text-text-muted-ui text-sm">/mo</span>}
                </div>
              </div>

              <div className="mb-6 space-y-2.5">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span className="text-text-secondary-ui text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              {isCurrentPlan ? (
                <Button className="w-full" variant="outline" disabled>
                  <span className="text-text-muted-ui">Current Plan</span>
                </Button>
              ) : key === 'free' ? (
                <Button className="w-full" variant="ghost" disabled>
                  Free Forever
                </Button>
              ) : (
                <Button
                  className="w-full"
                  variant={key === 'pro' ? 'primary' : 'secondary'}
                  loading={checkoutLoading === key}
                  onClick={() => handleCheckout(key)}
                >
                  {currentPlan !== 'free' ? 'Switch Plan' : 'Upgrade'}
                </Button>
              )}
            </Card>
          )
        })}
      </div>

      {/* Usage */}
      {data?.planInfo && (
        <Card className="border border-surface-input-border bg-card p-6">
          <h2 className="text-text-secondary-ui mb-4 text-lg font-bold">Plan Limits</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <UsageBar label="Brands" current={0} max={data.planInfo.brands} />
            <UsageBar label="Prompts" current={0} max={data.planInfo.prompts} />
            <UsageBar label="Scans / Day" current={0} max={data.planInfo.scansPerDay} />
          </div>
          <p className="mt-3 text-[10px] text-surface-200">
            Usage data updates periodically. Actual counts may differ slightly.
          </p>
        </Card>
      )}

      {/* FAQ */}
      <Card className="border border-surface-input-border bg-card p-6">
        <h2 className="text-text-secondary-ui mb-4 text-lg font-bold">Billing FAQ</h2>
        <div className="space-y-3">
          {[
            {
              q: 'Can I cancel anytime?',
              a: 'Yes, you can cancel your subscription at any time from the Manage Subscription portal. Your plan remains active until the end of the billing period.',
            },
            {
              q: 'What payment methods do you accept?',
              a: 'We accept all major credit cards (Visa, Mastercard, Amex) and some local payment methods through Stripe.',
            },
            {
              q: 'Do you offer refunds?',
              a: 'We offer a 14-day money-back guarantee for new subscriptions. Contact us for a refund within the first 14 days.',
            },
            {
              q: 'Can I switch plans?',
              a: 'Yes! Upgrading is instant, and downgrading takes effect at the next billing cycle. Prorated charges apply when upgrading.',
            },
          ].map((faq) => (
            <div key={faq.q} className="rounded-xl border border-nav-border bg-card p-3">
              <p className="text-text-primary-ui text-sm font-bold">{faq.q}</p>
              <p className="text-text-secondary-ui mt-1 text-xs">{faq.a}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ─── Usage Bar ───────────────────────────────────────────────────────────────

function UsageBar({ label, current, max }: { label: string; current: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-text-muted-ui text-xs font-bold">{label}</span>
        <span className="text-text-muted-ui text-xs">
          {current} / {max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-input">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-brand-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
