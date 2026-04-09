'use client'

import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-950 px-6 text-center">
      <div className="mb-6 text-6xl font-black text-white">Oops!</div>
      <h2 className="mb-3 text-xl font-bold text-white">Something went wrong</h2>
      <p className="mb-8 max-w-md text-sm text-gray-400">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <button
        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:bg-brand-500 active:scale-95"
        onClick={reset}
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </div>
  )
}
