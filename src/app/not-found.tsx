import Link from 'next/link'
import { Shield, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-950 px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-20" />

      <div className="relative z-10">
        <div className="bg-brand-600/20 border-brand-600/30 mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border">
          <Shield className="text-brand-400 h-8 w-8" />
        </div>

        <p className="mb-2 text-8xl font-black tracking-tighter text-white">404</p>
        <h1 className="mb-4 text-2xl font-bold text-white">Page not found</h1>
        <p className="mb-10 max-w-md text-gray-400">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <Link
          href="/"
          className="bg-brand-600 shadow-brand-600/25 hover:bg-brand-500 inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-white shadow-lg transition-all active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
      </div>
    </div>
  )
}
