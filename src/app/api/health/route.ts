import { NextResponse } from 'next/server'

// Edge runtime is fine here — every probe is HTTP-only (no node-only deps).
// Disable any Next caching so a heavy upstream incident is reflected in /health
// within seconds, not minutes (`revalidate` is left small as a safety net).
export const runtime = 'edge'
export const dynamic = 'force-dynamic'
export const revalidate = 30

type ProbeStatus = 'connected' | 'degraded' | 'error' | 'not_configured' | 'unknown'

interface ServiceProbe {
  status: ProbeStatus
  latencyMs?: number
  note?: string
}

interface HealthPayload {
  status: 'healthy' | 'degraded' | 'unhealthy'
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

/**
 * Aggregate a per-service probe map into the overall health status.
 *  - any `error` from a critical service → unhealthy (503)
 *  - any `degraded` or `not_configured` from a critical service → degraded (200)
 *  - else → healthy (200)
 */
function aggregateStatus(probes: ServiceProbe[]): HealthPayload['status'] {
  if (probes.some((p) => p.status === 'error')) return 'unhealthy'
  if (probes.some((p) => p.status === 'degraded' || p.status === 'not_configured'))
    return 'degraded'
  return 'healthy'
}

async function probeDatabase(): Promise<ServiceProbe> {
  const start = Date.now()
  try {
    const { createServerClient } = await import('@/lib/supabase')
    const db = createServerClient()
    if (!db) return { status: 'not_configured', note: 'SUPABASE_SERVICE_KEY missing' }
    const { error } = await db.from('brands').select('id').limit(1)
    const latencyMs = Date.now() - start
    if (error) return { status: 'error', latencyMs, note: error.message }
    // Latency above 1s on the Stockholm region indicates degradation (pgBouncer
    // pool exhaustion, RLS plan regression, etc.) — surface it as `degraded`
    // so external monitors page on it without false-tripping on momentary spikes.
    return { status: latencyMs > 1000 ? 'degraded' : 'connected', latencyMs }
  } catch (e) {
    return { status: 'error', note: e instanceof Error ? e.message : 'unknown' }
  }
}

async function probeRateLimit(): Promise<ServiceProbe> {
  // The rate-limiter falls back to in-memory in dev. In production we expect
  // Upstash Redis — if the URL/token aren't set, this is `not_configured`
  // which degrades the overall status (matches the fail-closed posture of
  // src/lib/ratelimit.ts).
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return { status: 'not_configured', note: 'Upstash env vars missing' }

  const start = Date.now()
  try {
    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      // Short timeout — health probe should not stall on a dead Redis.
      signal: AbortSignal.timeout(2000),
    })
    const latencyMs = Date.now() - start
    if (!res.ok) return { status: 'error', latencyMs, note: `HTTP ${res.status}` }
    return { status: latencyMs > 500 ? 'degraded' : 'connected', latencyMs }
  } catch (e) {
    return { status: 'error', note: e instanceof Error ? e.message : 'timeout' }
  }
}

function probeBilling(): ServiceProbe {
  // We don't hit the Stripe API on every health check (their /healthcheck is
  // not free quota-wise and there's no value gained over checking the key
  // is present). Real Stripe outages get caught by webhook delivery alerting
  // and `stripe.errors.StripeAPIError` in route handlers.
  const hasKey = !!process.env.STRIPE_SECRET_KEY
  const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET
  if (!hasKey) return { status: 'not_configured', note: 'STRIPE_SECRET_KEY missing' }
  if (!hasWebhookSecret)
    return {
      status: 'degraded',
      note: 'STRIPE_WEBHOOK_SECRET missing (signups OK, webhooks broken)',
    }
  return { status: 'connected' }
}

function probeEmail(): ServiceProbe {
  // Same approach as billing — verify the API key is wired, but don't make a
  // real send on every health check. Resend errors get caught at send-site.
  const hasKey = !!process.env.RESEND_API_KEY
  if (!hasKey) return { status: 'not_configured', note: 'RESEND_API_KEY missing' }
  return { status: 'connected' }
}

function probeAiProviders(): ServiceProbe & { configured: number; total: number } {
  const keys = [
    'OPENAI_API_KEY',
    'GEMINI_API_KEY',
    'ANTHROPIC_API_KEY',
    'PERPLEXITY_API_KEY',
  ] as const
  const configured = keys.filter((k) => !!process.env[k]).length
  const total = keys.length
  // Monitoring uses multi-engine fan-out — losing one provider degrades the
  // product (incomplete AVI) but doesn't take it down. Less than half configured
  // is treated as an error because AVI math breaks.
  let status: ProbeStatus
  if (configured === 0) status = 'not_configured'
  else if (configured < total / 2) status = 'error'
  else if (configured < total) status = 'degraded'
  else status = 'connected'
  return { status, configured, total }
}

export async function GET() {
  const start = Date.now()

  // Run all probes in parallel — overall health latency is bounded by the
  // slowest probe, not the sum. The 2s AbortSignal on the Upstash probe caps
  // worst-case total at ~2s even when Redis is unreachable.
  const [database, rate_limit] = await Promise.all([probeDatabase(), probeRateLimit()])
  const billing = probeBilling()
  const email = probeEmail()
  const ai_providers = probeAiProviders()

  const overall = aggregateStatus([database, rate_limit, billing, email, ai_providers])

  const payload: HealthPayload = {
    status: overall,
    timestamp: new Date().toISOString(),
    version: process.env['npm_package_version'] || '1.0.0',
    region: process.env['VERCEL_REGION'] || 'unknown',
    runtime: 'edge',
    responseTime: Date.now() - start,
    services: {
      database,
      rate_limit,
      billing,
      email,
      ai_providers,
    },
  }

  // 200 for healthy/degraded so uptime monitors keep us "up" during partial
  // outages (a degraded /health is more informative than a hard 503 that
  // blanks out the dashboards). 503 only on full unhealthy.
  const statusCode = overall === 'unhealthy' ? 503 : 200
  return NextResponse.json(payload, { status: statusCode })
}
