'use client'

import { useEffect, useState } from 'react'

/**
 * Says so, loudly, when the platform is running unmetered.
 *
 * Unlimited mode is a development affordance: every query is allowed at zero
 * cost and nothing reaches the credit ledger. The failure it guards against is
 * not technical — it is someone using the app for a week, believing the usage
 * numbers, and only later discovering none of it was recorded.
 *
 * It reads `/api/health` rather than an env var so there is exactly one source
 * of truth for the mode (`src/lib/platform-mode.ts`, server-side, including its
 * production lock). A NEXT_PUBLIC_ mirror would be a second copy that could
 * disagree with the first — and the copy the user sees disagreeing with the one
 * that bills them is the worst version of this bug.
 *
 * Delete this together with the unlimited mode.
 */
export function PlatformModeBanner() {
  const [mode, setMode] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!cancelled && body && typeof body.mode === 'string') setMode(body.mode)
      })
      // A banner must never be the reason the dashboard breaks. Silence is the
      // correct failure here: metered is the default, and metered shows nothing.
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  if (mode !== 'unlimited') return null

  return (
    <div
      role="status"
      className="mb-2 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
    >
      <span aria-hidden="true">⚠</span>
      <span>
        <strong className="font-semibold">Unlimited mode</strong> — credit metering is off. Queries
        cost nothing and are not recorded in the ledger.
      </span>
    </div>
  )
}
