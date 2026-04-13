'use client'

import { useState, type ReactNode } from 'react'
import { useBrandsQuery, useDeleteBrandMutation } from '@/hooks/useBrandsQuery'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
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
import type { Brand, BrandLanguage } from '@/types'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { JourneyGuide } from '@/components/JourneyGuide'

const LANGUAGE_FLAGS: Record<BrandLanguage, string> = {
  en: '🇬🇧 EN',
  it: '🇮🇹 IT',
  sv: '🇸🇪 SV',
}

function BrandCard({
  brand,
  onDelete,
  t,
}: {
  brand: Brand
  onDelete: (id: string) => void
  t: ReturnType<typeof useTranslations>
}): ReactNode {
  return (
    <Card className="hover:border-muted-foreground/30 group border-input p-6 transition-all">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl font-black text-white shadow-lg"
            style={{ background: brand.color, boxShadow: `0 4px 16px ${brand.color}40` }}
          >
            {brand.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-bold text-foreground">{brand.name}</h3>
              {brand.language && (
                <span className="shrink-0 rounded-md border border-input bg-input px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {LANGUAGE_FLAGS[brand.language as BrandLanguage] || '🇬🇧 EN'}
                </span>
              )}
            </div>
            {brand.domain && (
              <a
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
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
        <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{brand.description}</p>
      )}
      <div className="space-y-2.5">
        {brand.industry && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Tag className="h-3.5 w-3.5" />
            {brand.industry}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {brand.aliases?.slice(0, 3).map((a) => (
            <span
              key={a}
              className="rounded-md border border-input bg-input px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {a}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <div className="flex items-center gap-1.5">
          {brand.is_active ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-400">{t('brands.status.active')}</span>
            </>
          ) : (
            <>
              <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{t('brands.status.paused')}</span>
            </>
          )}
        </div>
        <Link href={`/dashboard/prompts?brand_id=${brand.id}`}>
          <Button size="sm" variant="outline">
            {t('sidebar.items.prompts')}
          </Button>
        </Link>
      </div>
    </Card>
  )
}

export default function BrandsPage() {
  const t = useTranslations()
  const { confirm, ConfirmDialog } = useConfirmDialog()

  // React Query — visible in TanStack devtools, cached, optimistic deletes
  const { data: brands = [], isLoading: loading, error: queryError, refetch } = useBrandsQuery()
  const deleteBrand = useDeleteBrandMutation()

  const error = queryError instanceof Error ? queryError.message : null

  const loadBrands = async () => {
    await refetch()
  }

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirm({
      title: t('brands.confirm_delete.title', { name }),
      description: t('brands.confirm_delete.description'),
      confirmLabel: t('brands.confirm_delete.confirm'),
      destructive: true,
    })
    if (!confirmed) return
    try {
      await deleteBrand.mutateAsync(id)
      toast.success(t('brands.toast.deleted', { name }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('brands.toast.delete_failed'))
    }
  }

  return (
    <div className="animate-in space-y-8">
      <JourneyGuide
        step={1}
        title={t('brands.journey_guide.title')}
        lead={t('brands.journey_guide.lead')}
        persistKey="brands"
        steps={[
          {
            label: t('brands.journey_guide.steps.click_new_brand'),
            description: t('brands.journey_guide.steps.click_new_brand_desc'),
          },
          {
            label: t('brands.journey_guide.steps.fill_details'),
            description: t('brands.journey_guide.steps.fill_details_desc'),
          },
          {
            label: t('brands.journey_guide.steps.pick_language'),
            description: t('brands.journey_guide.steps.pick_language_desc'),
          },
          {
            label: t('brands.journey_guide.steps.add_competitors'),
            description: t('brands.journey_guide.steps.add_competitors_desc'),
          },
        ]}
        outcomes={[
          t('brands.journey_guide.outcomes.brand_card'),
          t('brands.journey_guide.outcomes.prompts_library'),
          t('brands.journey_guide.outcomes.dashboards_unlock'),
        ]}
        cta={{ label: t('brands.journey_guide.cta'), href: '/dashboard/onboarding' }}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            {t('brands.page_title')}
          </h1>
          <p className="mt-1 text-muted-foreground">{t('brands.page_subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={loadBrands} disabled={loading}>
            <RefreshCw className={cn('h-5 w-5', loading && 'animate-spin')} />
          </Button>
          <Link href="/dashboard/brands/new" className="flex-1 sm:flex-none">
            <Button size="lg" className="w-full">
              <Plus className="h-5 w-5" /> {t('brands.new_brand')}
            </Button>
          </Link>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center text-red-400">
          <AlertCircle className="h-10 w-10" />
          <div>
            <p className="font-bold">{t('brands.error_state.title')}</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadBrands}>
            {t('brands.error_state.retry')}
          </Button>
        </div>
      )}

      {!loading && !error && brands.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Building2 className="mb-6 h-16 w-16 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-bold text-foreground">
            {t('brands.empty_state.title')}
          </h2>
          <p className="mb-8 max-w-sm text-muted-foreground">
            {t('brands.empty_state.description')}
          </p>
          <div className="flex gap-3">
            <Link href="/dashboard/onboarding">
              <Button size="lg" variant="outline">
                {t('brands.empty_state.guided_setup')}
              </Button>
            </Link>
            <Link href="/dashboard/brands/new">
              <Button size="lg">
                <Plus className="h-5 w-5" /> {t('brands.new_brand')}
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
              t={t}
            />
          ))}
        </div>
      )}
      <ConfirmDialog />
    </div>
  )
}
