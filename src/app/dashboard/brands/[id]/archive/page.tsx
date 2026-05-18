// PATH: src/app/dashboard/brands/[id]/archive/page.tsx
'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { Archive, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function BrandArchivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: brandId } = use(params)
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      const session = await supabase?.auth.getSession()
      if (!session?.data?.session) {
        router.push('/auth/login')
      } else {
        setLoading(false)
      }
    }
    checkAuth()
  }, [supabase, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <button
            onClick={() => router.push(`/dashboard/brands/${brandId}`)}
            className="mb-2 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to brand
          </button>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Brand Archive</h1>
          <p className="mt-1 text-muted-foreground">
            View all research queries, recommendations, and sentiment data
          </p>
        </div>

        {/* Placeholder - Components will be added as migrations run */}
        <div className="rounded-xl border border-border bg-secondary p-8 text-center shadow-sm">
          <div className="mb-4 flex justify-center">
            <div className="bg-brand-50 bg-primary/10 flex h-16 w-16 items-center justify-center rounded-full">
              <Archive className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h2 className="mb-2 text-xl font-bold text-foreground">Archive System</h2>
          <p className="mx-auto mb-6 max-w-md text-muted-foreground">
            Run the database migrations in Supabase to activate the archive system. This will enable
            timeline tracking, sentiment history, and recommendation insights.
          </p>
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <p>
              Endpoint:{' '}
              <code className="rounded bg-secondary px-2 py-0.5 text-primary">
                /api/archive/overview
              </code>
            </p>
            <p>
              Brand ID: <span className="font-mono text-xs">{brandId}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
