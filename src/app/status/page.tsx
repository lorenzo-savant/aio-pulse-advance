// PATH: src/app/status/page.tsx
//
// Public status page. Serves as a holding pattern until a proper hosted
// status page (BetterStack, Statuspage.io, Atlassian Statuspage) is set up.
//
// It polls /api/health on the client side so users get a near-real-time view
// of every probe in the health endpoint. No external dependency, no extra
// cost. The page is statically rendered at request time (no revalidation
// required) — the polling does the live work.
//
// Intentional choices:
//  - Polls every 30s (matches /api/health revalidate hint). Not a load test.
//  - Shows the last 10 readings as a sparkline-style status grid. Stored
//    in component state — no persistence. For longer history, use the
//    external uptime monitor referenced in the admin checklist.
//  - No auth, no PII. Anyone can hit this URL.
//
'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'
import { cn } from '@/lib/utils'

type ProbeStatus = 'connected' | 'degraded' | 'error' | 'not_configured' | 'unknown'
type OverallStatus = 'healthy' | 'degraded' | 'unhealthy'

interface ServiceProbe {
  status: ProbeStatus
  latencyMs?: number
  note?: string
}

interface HealthPayload {
  status: OverallStatus
  timestamp: string
  version: string
  region: string
  runtime: string
  responseTime: number
  services: {
    database: ServiceProbe
    rate_limit: ServiceProbe
    billing: ServiceProbe
    email: ServiceProbe
    ai_providers: ServiceProbe & { configured: number; total: number }
  }
}

const POLL_INTERVAL_MS = 30_000
const HISTORY_LENGTH = 20

const SERVICE_LABELS: Record<keyof HealthPayload['services'], string> = {
  database: 'Database',
  rate_limit: 'Rate Limit (Redis)',
  billing: 'Billing (Stripe)',
  email: 'Email (Resend)',
  ai_providers: 'AI Providers',
}

function StatusBadge({ status }: { status: OverallStatus }) {
  const config = {
    healthy: {
      label: 'All systems operational',
      Icon: CheckCircle2,
      className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    },
    degraded: {
      label: 'Partially degraded',
      Icon: AlertTriangle,
      className: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    },
    unhealthy: {
      label: 'Major outage',
      Icon: XCircle,
      className: 'bg-red-500/10 text-red-500 border-red-500/30',
    },
  }[status]

  return (
    <div
      className={cn(
        'inline-flex items-center gap-3 rounded-2xl border px-6 py-3 text-base font-bold',
        config.className,
      )}
    >
      <config.Icon className="h-5 w-5" />
      {config.label}
    </div>
  )
}

function ServiceRow({ name, probe }: { name: string; probe: ServiceProbe }) {
  const dotColor = {
    connected: 'bg-emerald-500',
    degraded: 'bg-amber-500',
    error: 'bg-red-500',
    not_configured: 'bg-muted-foreground',
    unknown: 'bg-muted-foreground',
  }[probe.status]

  return (
    <div className="flex items-center justify-between border-b border-border py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className={cn('h-2 w-2 rounded-full', dotColor)} />
        <span className="font-medium text-foreground">{name}</span>
      </div>
      <div className="flex items-center gap-4 text-sm">
        {probe.latencyMs !== undefined && (
          <span className="text-muted-foreground">{probe.latencyMs}ms</span>
        )}
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {probe.status.replace('_', ' ')}
        </span>
      </div>
    </div>
  )
}

function HistorySparkline({ history }: { history: OverallStatus[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">Collecting data…</p>
  }
  return (
    <div className="flex items-center gap-1">
      {history.map((s, i) => (
        <span
          key={i}
          title={s}
          className={cn(
            'h-8 w-1.5 rounded-sm',
            s === 'healthy' && 'bg-emerald-500',
            s === 'degraded' && 'bg-amber-500',
            s === 'unhealthy' && 'bg-red-500',
          )}
        />
      ))}
      <span className="ml-3 text-xs text-muted-foreground">
        Last {history.length} polls ({Math.round((POLL_INTERVAL_MS / 1000) * history.length)}s)
      </span>
    </div>
  )
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [history, setHistory] = useState<OverallStatus[]>([])
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' })
        const data = (await res.json()) as HealthPayload
        if (cancelled) return
        setHealth(data)
        setHistory((h) => [...h, data.status].slice(-HISTORY_LENGTH))
        setError(null)
        setLastFetch(new Date())
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to reach /api/health')
        // A fetch failure is itself meaningful — push 'unhealthy' to history.
        setHistory((h) => [...h, 'unhealthy' as const].slice(-HISTORY_LENGTH))
      }
    }

    poll()
    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-20">
        <header className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-black tracking-tight text-foreground md:text-5xl">
            AIO Pulse Status
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground">
            Real-time service health. Polls our /api/health endpoint every 30 seconds. For incident
            history and subscription to status updates, see our hosted status page (link in footer).
          </p>
        </header>

        <section className="mb-10 flex flex-col items-center gap-6">
          {health ? (
            <StatusBadge status={health.status} />
          ) : error ? (
            <StatusBadge status="unhealthy" />
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
              Checking…
            </div>
          )}
          <HistorySparkline history={history} />
        </section>

        <section className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h2 className="mb-1 text-xl font-bold text-foreground">Service health</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Per-component status from the most recent probe.
          </p>

          {health ? (
            <div>
              {(Object.keys(SERVICE_LABELS) as (keyof HealthPayload['services'])[]).map((key) => (
                <ServiceRow
                  key={key}
                  name={
                    key === 'ai_providers'
                      ? `${SERVICE_LABELS[key]} (${health.services.ai_providers.configured}/${health.services.ai_providers.total})`
                      : SERVICE_LABELS[key]
                  }
                  probe={health.services[key]}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for first reading…</p>
          )}

          <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
            <span>Region: {health?.region ?? '—'}</span>
            <span>Version: {health?.version ?? '—'}</span>
            <span>Last update: {lastFetch ? lastFetch.toLocaleTimeString() : '—'}</span>
          </div>
        </section>

        {error && (
          <p className="text-red-500 mt-6 text-center text-sm">
            Error reaching /api/health: {error}
          </p>
        )}
      </main>
    </div>
  )
}
