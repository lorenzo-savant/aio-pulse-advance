'use client'

// Site Audit Hub — single page bundling every AI-readiness check we
// have. Mounted as the analog to industry research "Site Audit" entry under
// AI Visibility. The pieces already exist scattered across other
// pages (Citations: crawler + capture; Optimizer: citation quality);
// this is a CONSOLIDATED view so operators don't have to hop between
// pages to answer "is my brand AI-pronto?".

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Loader2, ShieldCheck } from 'lucide-react'
import { CrawlerAccessPanel } from '@/components/CrawlerAccessPanel'
import { CitationCapturePanel } from '@/components/CitationCapturePanel'
import { SiteAuditFoundationsCard } from '@/components/SiteAuditFoundationsCard'
import { CitationQualityCard } from '@/components/CitationQualityCard'
import { TopicFinderPanel } from '@/components/TopicFinderPanel'

interface BrandLite {
  id: string
  name: string
  domain?: string | null
}

export default function SiteAuditPage() {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [selectedBrand, setSelectedBrand] = useState<BrandLite | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/brands')
      .then((r) => r.json() as Promise<{ data?: BrandLite[]; message?: string }>)
      .then((j) => {
        if (cancelled) return
        const list = j.data ?? []
        setBrands(list)
        if (list[0]) setSelectedBrand(list[0])
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load brands')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }
  if (error) return <Card className="p-6 text-sm text-rose-400">{error}</Card>
  if (brands.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        No brands configured yet. Set one up under <b>Brands</b> first — site audit needs a brand
        domain to probe.
      </Card>
    )
  }

  // Citation-quality card needs an input + mode; the most useful
  // probe on this page is the brand's own homepage in URL mode.
  const probeUrl = selectedBrand?.domain
    ? `https://${selectedBrand.domain.replace(/^https?:\/\//i, '').replace(/\/.*$/, '')}`
    : ''

  return (
    <div className="animate-in space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-brand" />
            <h1 className="text-3xl font-black tracking-tight text-foreground">Site Audit</h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            One-page AI-readiness check: foundations, crawler access, citation capture, and content
            quality. Fix the red items at the top before optimising the rest.
          </p>
        </div>
        {brands.length > 1 && (
          <select
            className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            value={selectedBrand?.id ?? ''}
            onChange={(e) => {
              const b = brands.find((x) => x.id === e.target.value)
              if (b) setSelectedBrand(b)
            }}
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedBrand ? (
        <>
          {/* 1. Foundations — binary presence checks (HTTPS, llms.txt
              variants, sitemap). Most basic; if these fail nothing
              else matters. */}
          <SiteAuditFoundationsCard brandId={selectedBrand.id} />

          {/* 2. AI crawler access from robots.txt — auto-runs. */}
          <CrawlerAccessPanel brandId={selectedBrand.id} />

          {/* 3. Citation capture — uses existing monitoring data. */}
          <CitationCapturePanel brandId={selectedBrand.id} />

          {/* 4. Topic Finder — clusters the gap list into ranked content
              opportunities. Direct port of industry content > Topic
              Finder applied to AI-citation gaps. */}
          <TopicFinderPanel brandId={selectedBrand.id} />

          {/* 5. Citation Quality — scores the homepage HTML against the
              5 AI-citation signals. Operator clicks "Score" to
              fire the URL fetch (avoids silent cost). */}
          {probeUrl && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                Homepage content quality — {probeUrl}
              </p>
              <CitationQualityCard input={probeUrl} mode="url" />
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
