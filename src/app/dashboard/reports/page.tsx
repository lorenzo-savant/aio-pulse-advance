// PATH: src/app/dashboard/reports/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, Palette, Save, Check, Zap, Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/Card'
import { SectionHelp } from '@/components/help/SectionHelp'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { AeoBridgeButton } from '@/components/AeoBridgeButton'
import { ReportSchedulesPanel } from '@/components/ReportSchedulesPanel'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Brand {
  id: string
  name: string
  domain: string | null
  color: string
  report_logo_url: string | null
  report_brand_name: string | null
  report_primary_color: string | null
}

interface ReportSettings {
  logoUrl: string
  brandName: string
  primaryColor: string
  showPoweredBy: boolean
  headerStyle: 'minimal' | 'banner' | 'centered'
  includeExecutiveSummary: boolean
  includeEngineBreakdown: boolean
  includeCompetitors: boolean
  includeSentiment: boolean
  includeKeywords: boolean
  includeRecommendations: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const t = useTranslations('reports')
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [settings, setSettings] = useState<ReportSettings>({
    logoUrl: '',
    brandName: '',
    primaryColor: '#6366f1',
    showPoweredBy: true,
    headerStyle: 'banner',
    includeExecutiveSummary: true,
    includeEngineBreakdown: true,
    includeCompetitors: true,
    includeSentiment: true,
    includeKeywords: true,
    includeRecommendations: true,
  })
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [dateRange, setDateRange] = useState(30)

  // Load brands
  useEffect(() => {
    async function loadBrands() {
      try {
        const res = await fetch('/api/brands')
        const data = await res.json()
        const list: Brand[] = data.data || data || []
        setBrands(list)
        if (list.length > 0) {
          setSelectedBrand(list[0]!)
          applyBrandSettings(list[0]!)
        }
      } catch {
        console.error('Failed to load brands')
      }
    }
    loadBrands()
  }, [])

  const applyBrandSettings = (brand: Brand) => {
    setSettings((s) => ({
      ...s,
      logoUrl: brand.report_logo_url || '',
      brandName: brand.report_brand_name || brand.name,
      primaryColor: brand.report_primary_color || brand.color || '#6366f1',
    }))
  }

  // Save white-label settings
  const handleSave = async () => {
    if (!selectedBrand) return
    setSaving(true)
    try {
      const res = await fetch(`/api/brands/${selectedBrand.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_logo_url: settings.logoUrl || null,
          report_brand_name: settings.brandName || null,
          report_primary_color: settings.primaryColor || null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      toast.success(t('settings_saved'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('save_failed'))
    } finally {
      setSaving(false)
    }
  }

  // Generate PDF report
  const handleGenerate = async () => {
    if (!selectedBrand) return
    setGenerating(true)
    try {
      const from = new Date()
      from.setDate(from.getDate() - dateRange)
      const fromStr = from.toISOString().split('T')[0]
      const toStr = new Date().toISOString().split('T')[0]

      const res = await fetch(
        `/api/export?brand_id=${selectedBrand.id}&format=pdf&from=${fromStr}&to=${toStr}`,
      )
      if (!res.ok) {
        // Try to read the JSON error message
        let msg = 'Failed to generate report'
        try {
          const errData = await res.json()
          msg = errData.message || msg
        } catch {
          // Response wasn't JSON
        }
        throw new Error(msg)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${settings.brandName || selectedBrand.name}-report-${fromStr}.pdf`
      a.click()
      URL.revokeObjectURL(url)

      toast.success(t('downloaded'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('generate_failed'))
    } finally {
      setGenerating(false)
    }
  }

  // Labels and descriptions live in the catalog under reports.header_*.
  const HEADER_STYLES = ['minimal', 'banner', 'centered'] as const

  // Labels and descriptions live in the catalog under reports.section_*.
  const REPORT_SECTIONS = [
    { key: 'includeExecutiveSummary', slug: 'executive_summary' },
    { key: 'includeEngineBreakdown', slug: 'engine_breakdown' },
    { key: 'includeCompetitors', slug: 'competitors' },
    { key: 'includeSentiment', slug: 'sentiment' },
    { key: 'includeKeywords', slug: 'keywords' },
    { key: 'includeRecommendations', slug: 'recommendations' },
  ] as const

  return (
    <div className="space-y-6 bg-background">
      <SectionHelp section="reports" />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              {t('page_title')}
            </h1>
          </div>
          <p className="mt-1 text-muted-foreground">{t('page_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {brands.length > 1 && (
            <select
              className="rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground"
              value={selectedBrand?.id || ''}
              onChange={(e) => {
                const b = brands.find((b) => b.id === e.target.value)
                if (b) {
                  setSelectedBrand(b)
                  applyBrandSettings(b)
                }
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
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Settings Column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Branding */}
          <Card className="border border-input bg-card p-6">
            <h2 className="text-text-secondary-ui mb-4 flex items-center gap-2 text-lg font-bold">
              <Palette className="h-5 w-5 text-muted-foreground" /> {t('branding')}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {t('brand_name')}
                </label>
                <input
                  className="placeholder-text-muted-ui w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                  placeholder={t('brand_name_placeholder')}
                  value={settings.brandName}
                  onChange={(e) => setSettings({ ...settings, brandName: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {t('logo_url')}
                </label>
                <input
                  className="placeholder-text-muted-ui w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                  placeholder="https://youragency.com/logo.png"
                  value={settings.logoUrl}
                  onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {t('primary_color')}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    className="h-10 w-10 cursor-pointer rounded-lg border border-input"
                    value={settings.primaryColor}
                    onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  />
                  <input
                    className="w-32 rounded-xl border border-input bg-input px-4 py-2.5 font-mono text-sm text-foreground outline-none focus:border-primary"
                    value={settings.primaryColor}
                    onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                <div>
                  <p className="text-text-secondary-ui text-sm font-bold">{t('show_powered_by')}</p>
                  <p className="text-[10px] text-muted-foreground">{t('show_powered_by_hint')}</p>
                </div>
                <button
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors',
                    settings.showPoweredBy ? 'bg-primary' : 'bg-secondary',
                  )}
                  onClick={() =>
                    setSettings({ ...settings, showPoweredBy: !settings.showPoweredBy })
                  }
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full transition-transform',
                      settings.showPoweredBy ? 'left-[22px]' : 'left-0.5',
                    )}
                  />
                </button>
              </div>
            </div>
          </Card>

          {/* Header Style */}
          <Card className="border border-input bg-card p-6">
            <h2 className="text-text-secondary-ui mb-4 text-lg font-bold">{t('header_style')}</h2>
            <div className="grid grid-cols-3 gap-3">
              {HEADER_STYLES.map((style) => (
                <button
                  key={style}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-all',
                    settings.headerStyle === style
                      ? 'border-brand-500 bg-primary/10'
                      : 'border-input hover:border-border',
                  )}
                  onClick={() => setSettings({ ...settings, headerStyle: style })}
                >
                  <p className="text-text-secondary-ui text-sm font-bold">{t(`header_${style}`)}</p>
                  <p className="text-[10px] text-muted-foreground">{t(`header_${style}_desc`)}</p>
                  {settings.headerStyle === style && (
                    <Check className="mt-2 h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </Card>

          {/* Report Sections */}
          <Card className="border border-input bg-card p-6">
            <h2 className="text-text-secondary-ui mb-4 text-lg font-bold">
              {t('report_sections')}
            </h2>
            <div className="space-y-2">
              {REPORT_SECTIONS.map((section) => (
                <div
                  key={section.key}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
                >
                  <div>
                    <p className="text-text-secondary-ui text-sm font-bold">
                      {t(`section_${section.slug}`)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {t(`section_${section.slug}_desc`)}
                    </p>
                  </div>
                  <button
                    className={cn(
                      'relative h-6 w-11 rounded-full transition-colors',
                      settings[section.key] ? 'bg-primary' : 'bg-secondary',
                    )}
                    onClick={() =>
                      setSettings({ ...settings, [section.key]: !settings[section.key] })
                    }
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-5 w-5 rounded-full transition-transform',
                        settings[section.key] ? 'left-[22px]' : 'left-0.5',
                      )}
                    />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Preview + Actions Column */}
        <div className="space-y-6">
          {/* Preview */}
          <Card className="overflow-hidden border border-border bg-secondary">
            <div
              className="p-6"
              style={{
                background:
                  settings.headerStyle === 'banner'
                    ? `linear-gradient(135deg, ${settings.primaryColor}, ${settings.primaryColor}88)`
                    : undefined,
              }}
            >
              {settings.headerStyle === 'banner' && (
                <div className="text-center">
                  {settings.logoUrl && (
                    <img
                      src={settings.logoUrl}
                      alt={t('logo_alt')}
                      className="mx-auto mb-3 h-10"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                  <h3 className="text-lg font-black text-foreground">
                    {settings.brandName || t('brand_report_fallback')}
                  </h3>
                  <p className="text-foreground/60 mt-1 text-xs">{t('ai_visibility_report')}</p>
                </div>
              )}
              {settings.headerStyle === 'minimal' && (
                <div className="flex items-center gap-3">
                  {settings.logoUrl && (
                    <img
                      src={settings.logoUrl}
                      alt={t('logo_alt')}
                      className="h-8"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                  <div>
                    <h3 className="text-sm font-black text-foreground">
                      {settings.brandName || t('brand_report_fallback')}
                    </h3>
                    <p className="text-[10px] text-muted-foreground">{t('ai_visibility_report')}</p>
                  </div>
                </div>
              )}
              {settings.headerStyle === 'centered' && (
                <div className="text-center">
                  {settings.logoUrl && (
                    <img
                      src={settings.logoUrl}
                      alt={t('logo_alt')}
                      className="mx-auto mb-3 h-12"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                  <h3 className="text-lg font-black text-foreground">
                    {settings.brandName || 'Brand Report'}
                  </h3>
                </div>
              )}
            </div>
            <div className="space-y-3 p-4">
              {REPORT_SECTIONS.filter((s) => settings[s.key]).map((section) => (
                <div key={section.key} className="rounded-lg border border-input bg-card p-3">
                  <p className="text-text-secondary-ui text-xs font-bold">
                    {t(`section_${section.slug}`)}
                  </p>
                  <div className="bg-input-border mt-1 h-2 w-3/4 rounded" />
                  <div className="bg-input-border mt-1 h-2 w-1/2 rounded" />
                </div>
              ))}
              {settings.showPoweredBy && (
                <p className="text-center text-[9px] text-muted-foreground">{t('powered_by')}</p>
              )}
            </div>
          </Card>

          {/* Actions */}
          <Card className="border border-input bg-card p-5">
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {t('date_range')}
                </label>
                <select
                  className="w-full rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground"
                  value={dateRange}
                  onChange={(e) => setDateRange(Number(e.target.value))}
                >
                  <option value={7}>{t('last_days', { count: 7 })}</option>
                  <option value={14}>{t('last_days', { count: 14 })}</option>
                  <option value={30}>{t('last_days', { count: 30 })}</option>
                  <option value={90}>{t('last_days', { count: 90 })}</option>
                </select>
              </div>
              <Button className="w-full" loading={saving} onClick={handleSave}>
                <Save className="h-4 w-4" /> {t('save_settings')}
              </Button>
              <Button
                className="w-full"
                variant="secondary"
                loading={generating}
                onClick={handleGenerate}
              >
                <Download className="h-4 w-4" /> {t('generate_pdf')}
              </Button>
            </div>
          </Card>

          {selectedBrand && (
            <Card className="border border-input bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{t('agent_system')}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t('agent_system_hint')}</p>
                  </div>
                </div>
                <Badge variant="default" className="text-xs">
                  {t('agent_mode')}
                </Badge>
              </div>

              <div className="bg-secondary/40 mb-4 rounded-xl border border-border p-4">
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t('scheduled_runs')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{t('scheduled_runs_hint')}</p>
                  </div>
                </div>
              </div>

              <AeoBridgeButton
                brandId={selectedBrand.id}
                clientDomain={selectedBrand.domain ?? ''}
                dateRangeDays={dateRange}
              />
            </Card>
          )}

          {/* Scheduled deliveries — recurring email delivery of the
              white-label PDF via the cron-driven report-delivery
              route. See /api/cron/report-delivery + migration
              20260527000000_report_schedules.sql. */}
          {selectedBrand && <ReportSchedulesPanel brandId={selectedBrand.id} />}
        </div>
      </div>
    </div>
  )
}
