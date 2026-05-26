// PATH: src/app/dashboard/reports/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, Palette, Save, Check, Zap, Clock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHelp } from '@/components/help/SectionHelp'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { AeoBridgeButton } from '@/components/AeoBridgeButton'

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
      toast.success('Report settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
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

      toast.success('Report downloaded!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate')
    } finally {
      setGenerating(false)
    }
  }

  const HEADER_STYLES = [
    { id: 'minimal', label: 'Minimal', desc: 'Clean, simple header' },
    { id: 'banner', label: 'Banner', desc: 'Full-width colored banner' },
    { id: 'centered', label: 'Centered', desc: 'Centered logo and title' },
  ] as const

  const REPORT_SECTIONS = [
    {
      key: 'includeExecutiveSummary',
      label: 'Executive Summary',
      desc: 'AI visibility overview and key metrics',
    },
    {
      key: 'includeEngineBreakdown',
      label: 'Engine Breakdown',
      desc: 'Per-engine citation rates and scores',
    },
    {
      key: 'includeCompetitors',
      label: 'Competitor Analysis',
      desc: 'Competitor citation comparisons',
    },
    {
      key: 'includeSentiment',
      label: 'Sentiment Analysis',
      desc: 'Brand sentiment across AI engines',
    },
    { key: 'includeKeywords', label: 'Keywords', desc: 'Top keywords and trends' },
    {
      key: 'includeRecommendations',
      label: 'Recommendations',
      desc: 'AI-generated improvement suggestions',
    },
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
              White-Label Reports
            </h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            Customize and generate branded PDF reports for your clients.
          </p>
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
              <Palette className="h-5 w-5 text-muted-foreground" /> Branding
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Report Brand Name
                </label>
                <input
                  className="placeholder-text-muted-ui w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                  placeholder="Your Agency Name"
                  value={settings.brandName}
                  onChange={(e) => setSettings({ ...settings, brandName: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Logo URL
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
                  Primary Color
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
                  <p className="text-text-secondary-ui text-sm font-bold">
                    Show &quot;Powered by AIO Pulse&quot;
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Display a small attribution in the report footer
                  </p>
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
            <h2 className="text-text-secondary-ui mb-4 text-lg font-bold">Header Style</h2>
            <div className="grid grid-cols-3 gap-3">
              {HEADER_STYLES.map((style) => (
                <button
                  key={style.id}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-all',
                    settings.headerStyle === style.id
                      ? 'border-brand-500 bg-primary/10'
                      : 'border-input hover:border-border',
                  )}
                  onClick={() => setSettings({ ...settings, headerStyle: style.id })}
                >
                  <p className="text-text-secondary-ui text-sm font-bold">{style.label}</p>
                  <p className="text-[10px] text-muted-foreground">{style.desc}</p>
                  {settings.headerStyle === style.id && (
                    <Check className="mt-2 h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </Card>

          {/* Report Sections */}
          <Card className="border border-input bg-card p-6">
            <h2 className="text-text-secondary-ui mb-4 text-lg font-bold">Report Sections</h2>
            <div className="space-y-2">
              {REPORT_SECTIONS.map((section) => (
                <div
                  key={section.key}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
                >
                  <div>
                    <p className="text-text-secondary-ui text-sm font-bold">{section.label}</p>
                    <p className="text-[10px] text-muted-foreground">{section.desc}</p>
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
                      alt="Logo"
                      className="mx-auto mb-3 h-10"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                  <h3 className="text-lg font-black text-foreground">
                    {settings.brandName || 'Brand Report'}
                  </h3>
                  <p className="text-foreground/60 mt-1 text-xs">AI Visibility Report</p>
                </div>
              )}
              {settings.headerStyle === 'minimal' && (
                <div className="flex items-center gap-3">
                  {settings.logoUrl && (
                    <img
                      src={settings.logoUrl}
                      alt="Logo"
                      className="h-8"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                  <div>
                    <h3 className="text-sm font-black text-foreground">
                      {settings.brandName || 'Brand Report'}
                    </h3>
                    <p className="text-[10px] text-muted-foreground">AI Visibility Report</p>
                  </div>
                </div>
              )}
              {settings.headerStyle === 'centered' && (
                <div className="text-center">
                  {settings.logoUrl && (
                    <img
                      src={settings.logoUrl}
                      alt="Logo"
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
                  <p className="text-text-secondary-ui text-xs font-bold">{section.label}</p>
                  <div className="bg-input-border mt-1 h-2 w-3/4 rounded" />
                  <div className="bg-input-border mt-1 h-2 w-1/2 rounded" />
                </div>
              ))}
              {settings.showPoweredBy && (
                <p className="text-center text-[9px] text-muted-foreground">Powered by AIO Pulse</p>
              )}
            </div>
          </Card>

          {/* Actions */}
          <Card className="border border-input bg-card p-5">
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Date Range
                </label>
                <select
                  className="w-full rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground"
                  value={dateRange}
                  onChange={(e) => setDateRange(Number(e.target.value))}
                >
                  <option value={7}>Last 7 days</option>
                  <option value={14}>Last 14 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
              </div>
              <Button className="w-full" loading={saving} onClick={handleSave}>
                <Save className="h-4 w-4" /> Save Settings
              </Button>
              <Button
                className="w-full"
                variant="secondary"
                loading={generating}
                onClick={handleGenerate}
              >
                <Download className="h-4 w-4" /> Generate PDF Report
              </Button>
            </div>
          </Card>

          {selectedBrand && (
            <Card className="border border-input bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="text-lg font-bold text-foreground">AEO Agent System</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Automatisk analys körs dagligen 07:00. Kör manuellt vid behov.
                    </p>
                  </div>
                </div>
                <Badge variant="default" className="text-xs">
                  Automatisk + Manuell
                </Badge>
              </div>

              <div className="bg-secondary/40 mb-4 rounded-xl border border-border p-4">
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Schemalagda körningar
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Varje dag 07:00 — alla aktiva brand skickas automatiskt till AEO-systemet.
                      Agenter analyserar och returnerar optimeringsförslag inom ~10 minuter.
                    </p>
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
        </div>
      </div>
    </div>
  )
}
