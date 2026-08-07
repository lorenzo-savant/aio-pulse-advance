'use client'

// Shows an operator that an AI provider has stopped accepting billed calls,
// on every page, before a customer notices the data went quiet.
//
// WHY THIS EXISTS
// On 2026-08-07 the Anthropic key returned "Your credit balance is too low" on
// every request and nothing in the product said so. Engine Info reported Claude
// as operational — it was hardcoded — no cost dashboard is reachable, and there
// are no alert rules configured. The outage was invisible until someone went
// looking at the provider's own API by hand.
//
// The detection now exists: providers record a billing failure from real calls
// (lib/providers/credit-state), and /api/providers/health reports it. What was
// missing was somewhere an operator would actually see it, which is this.
//
// DELIBERATELY SILENT WHEN HEALTHY
// It renders nothing at all unless a provider is genuinely out of credit —
// not when a provider is merely unknown, and not as a permanent status widget.
// A badge that is always present stops being read, and this one only matters
// on the day it appears.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { buildCreditWarning, type CreditWarning } from '@/lib/providers/credit-warning'

/** Poll interval. Slow on purpose: an exhausted balance is not a fast-moving
 *  condition, and the endpoint is shared with the Engine Info page. */
const POLL_MS = 5 * 60 * 1000

export function ProviderCreditWarning() {
  const [warning, setWarning] = useState<CreditWarning | null>(null)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const res = await fetch('/api/providers/health')
        const data = await res.json()
        const next = buildCreditWarning(data?.providers)
        // Only ever move to a NEW verdict. A failed or malformed check is not
        // evidence the balance was topped up, and clearing a live warning on a
        // blip is the one failure this surface cannot afford.
        if (!cancelled && next) setWarning(next)
        if (!cancelled && !next && Array.isArray(data?.providers)) setWarning(null)
      } catch {
        // Leave the previous verdict alone.
      }
    }

    void check()
    const timer = setInterval(() => void check(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  if (!warning) return null

  return (
    <Link href="/dashboard/monitor" title={warning.label} aria-label={warning.label}>
      <span className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">{warning.badge}</span>
        <span className="sm:hidden">{warning.drained.length}</span>
      </span>
    </Link>
  )
}
