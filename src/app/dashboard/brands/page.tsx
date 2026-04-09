'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Plus,
  Building2,
  Globe,
  Tag,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Brand } from '@/types'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'

function BrandCard({
  brand,
  onDelete,
}: {
  brand: Brand
  onDelete: (id: string) => void
}): ReactNode {
  return (
    <Card className="group border-surface-input-border p-6 transition-all hover:border-nav-text/30">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl font-black text-white shadow-lg"
            style={{ background: brand.color, boxShadow: `0 4px 16px ${brand.color}40` }}
          >
            {brand.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-bold text-text-on-surface">{brand.name}</h3>
            {brand.domain && (
              <a
                className="flex items-center gap-1 text-xs text-text-muted-surface hover:text-text-secondary-surface"
                href={`https://${brand.domain}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Globe className="h-3 w-3" />
                <span className="truncate">{brand.domain}</span>
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Link href={`/dashboard/brands/${brand.id}`}>
            <Button size="icon" variant="ghost">
              <Edit3 className="h-4 w-4" />
            </Button>
          </Link>
          <Button size="icon" variant="ghost" onClick={() => onDelete(brand.id)}>
            <Trash2 className="h-4 w-4 text-red-400" />
          </Button>
        </div>
      </div>

      {brand.description && (
        <p className="mb-4 line-clamp-2 text-sm text-text-muted-surface">{brand.description}</p>
      )}
      <div className="space-y-2.5">
        {brand.industry && (
          <div className="flex items-center gap-2 text-xs text-text-muted-surface">
            <Tag className="h-3.5 w-3.5" />
            {brand.industry}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {brand.aliases?.slice(0, 3).map((a) => (
            <span
              key={a}
              className="rounded-md border border-surface-input-border bg-surface-input px-2 py-0.5 text-[10px] text-text-muted-surface"
            >
              {a}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-nav-border pt-4">
        <div className="flex items-center gap-1.5">
          {brand.is_active ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-400">Active</span>
            </>
          ) : (
            <>
              <XCircle className="h-3.5 w-3.5 text-text-secondary-surface" />
              <span className="text-xs text-text-secondary-surface">Paused</span>
            </>
          )}
        </div>
        <Link href={`/dashboard/prompts?brand_id=${brand.id}`}>
          <Button size="sm" variant="outline">
            Prompt
          </Button>
        </Link>
      </div>
    </Card>
  )
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { confirm, ConfirmDialog } = useConfirmDialog()

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirm({
      title: `Delete "${name}"?`,
      description: 'All monitoring data will also be removed. This action cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!confirmed) return
    try {
      const res = await fetch(`/api/brands/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.message)
      setBrands((b) => b.filter((x) => x.id !== id))
      toast.success(`"${name}" deleted`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const loadBrands = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/brands')

      const text = await res.text()

      if (!text || text.trim() === '') {
        setBrands([])
        return
      }

      let json
      try {
        json = JSON.parse(text)
      } catch {
        console.error('[BrandsPage] Invalid JSON response:', text)
        if (!res.ok) {
          setError(`Server error (${res.status}): ${text.substring(0, 200)}`)
        } else {
          setError('Invalid response from server')
        }
        return
      }

      if (!res.ok) {
        setError(json.message || `Server error (${res.status})`)
        return
      }

      if (!json.success) {
        setError(json.message || `Server error`)
        return
      }

      setBrands(json.data ?? [])
    } catch (err) {
      console.error('[BrandsPage] Load error:', err)
      const msg = err instanceof Error ? err.message : 'Failed to load brands'
      if (msg.includes('fetch failed') || msg.includes('Failed to fetch')) {
        setError('Unable to connect to server. Is the dev server running?')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBrands()
  }, [loadBrands])

  return (
    <div className="animate-in space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-text-on-surface">Your Brands</h1>
          <p className="mt-1 text-text-muted-surface">
            Manage brands monitored in AI search engines.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={loadBrands} disabled={loading}>
            <RefreshCw className={cn('h-5 w-5', loading && 'animate-spin')} />
          </Button>
          <Link href="/dashboard/brands/new" className="flex-1 sm:flex-none">
            <Button size="lg" className="w-full">
              <Plus className="h-5 w-5" /> New Brand
            </Button>
          </Link>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="text-brand h-8 w-8 animate-spin" />
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center text-red-400">
          <AlertCircle className="h-10 w-10" />
          <div>
            <p className="font-bold">An error occurred</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadBrands}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && brands.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Building2 className="mb-6 h-16 w-16 text-text-muted-surface" />
          <h2 className="mb-2 text-xl font-bold text-text-on-surface">No brands found</h2>
          <p className="mb-8 max-w-sm text-text-muted-surface">
            Create your first brand to start monitoring visibility.
          </p>
          <div className="flex gap-3">
            <Link href="/dashboard/onboarding">
              <Button size="lg" variant="outline">
                Guided Setup
              </Button>
            </Link>
            <Link href="/dashboard/brands/new">
              <Button size="lg">
                <Plus className="h-5 w-5" /> New Brand
              </Button>
            </Link>
          </div>
        </div>
      )}

      {!loading && brands.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {brands.map((brand) => (
            <BrandCard
              key={brand.id}
              brand={brand}
              onDelete={(id) => handleDelete(id, brand.name)}
            />
          ))}
        </div>
      )}
      <ConfirmDialog />
    </div>
  )
}
