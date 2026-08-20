'use client'

// AI Article Generator — produces draft Markdown articles optimised
// against the same 5 AI-citation signals that CitationQualityCard
// measures. Operator picks brand + topic + intent + length (+ optional
// format hint from Topic Finder), the LLM chain generates a draft, and
// the result is auto-scored. Operator can copy / download the markdown
// or regenerate.

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Wand2, Loader2, AlertTriangle, Copy, Check, Download, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BrandLite {
  id: string
  name: string
  domain?: string | null
}

type ArticleIntent = 'B1' | 'B2' | 'B3' | 'B4' | 'B5'
type ArticleLength = 'short' | 'medium' | 'long'
type FormatHint = 'paragraph' | 'faq' | 'comparison' | 'how-to' | 'table' | 'list'

interface PillarScore {
  score: number
  recommendation: string
}

interface QualityScore {
  overall: number
  band: 'strong' | 'medium' | 'weak'
  pillars: Record<'clarity' | 'eeat' | 'qa' | 'structure' | 'structuredData', PillarScore>
  topRecommendations: string[]
}

interface GenerateOutput {
  markdown: string
  qualityScore: QualityScore
  provider: string
  model: string
  systemPromptDigest: string
}

// Labels live in the message catalog: content_generator.intent_<value lowercased>
// and content_generator.format_<value>.
const INTENT_OPTIONS: ArticleIntent[] = ['B1', 'B2', 'B3', 'B4', 'B5']

const FORMAT_OPTIONS: FormatHint[] = ['paragraph', 'faq', 'comparison', 'how-to', 'table', 'list']

function bandColor(band: QualityScore['band']): string {
  if (band === 'strong') return 'text-emerald-400'
  if (band === 'medium') return 'text-amber-300'
  return 'text-rose-400'
}

export default function ContentGeneratorPage() {
  const t = useTranslations('content_generator')
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [brandId, setBrandId] = useState<string>('')
  const [topic, setTopic] = useState<string>('')
  const [intent, setIntent] = useState<ArticleIntent>('B3')
  const [length, setLength] = useState<ArticleLength>('medium')
  const [formatHint, setFormatHint] = useState<FormatHint | ''>('')
  const [output, setOutput] = useState<GenerateOutput | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/brands')
      .then((r) => r.json() as Promise<{ data?: BrandLite[] }>)
      .then((j) => {
        if (cancelled) return
        const list = j.data ?? []
        setBrands(list)
        if (!brandId && list[0]) setBrandId(list[0].id)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generate() {
    if (!brandId || !topic.trim()) return
    setLoading(true)
    setError(null)
    setOutput(null)
    try {
      const res = await fetch(`/api/brands/${brandId}/generate-article`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          intent,
          length,
          formatHint: formatHint || undefined,
        }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.message || 'Generation failed')
      setOutput(j.data as GenerateOutput)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  function copyMarkdown() {
    if (!output) return
    navigator.clipboard.writeText(output.markdown).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function downloadMarkdown() {
    if (!output) return
    const filename = `${
      topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 40) || 'article'
    }.md`
    const blob = new Blob([output.markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectedBrand = brands.find((b) => b.id === brandId)

  return (
    <div className="animate-in space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Wand2 className="h-6 w-6 text-brand" />
          <h1 className="text-3xl font-black tracking-tight text-foreground">{t('page_title')}</h1>
        </div>
        <p className="mt-1 text-muted-foreground">{t('page_subtitle')}</p>
      </div>

      {/* Input form */}
      <Card className="p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t('brand_required')}
            </label>
            <select
              className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t('topic_required')}
            </label>
            <input
              className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
              placeholder={t('topic_placeholder')}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={300}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t('intent')}
            </label>
            <select
              className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
              value={intent}
              onChange={(e) => setIntent(e.target.value as ArticleIntent)}
            >
              {INTENT_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {t(`intent_${o.toLowerCase()}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t('length')}
            </label>
            <div className="flex gap-2">
              {(['short', 'medium', 'long'] as ArticleLength[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLength(l)}
                  className={cn(
                    'flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors',
                    length === l
                      ? 'bg-brand/15 border-brand text-brand'
                      : 'bg-secondary/50 border-border text-muted-foreground hover:border-border',
                  )}
                >
                  {t(`length_${l}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t('format_hint')}
            </label>
            <select
              className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
              value={formatHint}
              onChange={(e) => setFormatHint(e.target.value as FormatHint | '')}
            >
              <option value="">{t('no_hint')}</option>
              {FORMAT_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {t(`format_${o}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          {selectedBrand && (
            <span className="text-xs text-muted-foreground">
              {t('generating_for')} <b>{selectedBrand.name}</b>
              {selectedBrand.domain ? ` (${selectedBrand.domain})` : ''}
            </span>
          )}
          <Button onClick={generate} disabled={loading || !brandId || !topic.trim()} size="lg">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {loading ? t('generating') : output ? t('regenerate') : t('generate_article')}
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          {error}
        </Card>
      )}

      {loading && !output && (
        <Card className="p-6 text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t('drafting')}
        </Card>
      )}

      {output && (
        <>
          {/* Quality score header */}
          <Card className="p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={cn('text-4xl font-black', bandColor(output.qualityScore.band))}>
                  {output.qualityScore.overall}
                </span>
                <div>
                  <p className="text-sm font-bold text-foreground">{t('quality_score')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('quality_score_hint')}{' '}
                    <b className={bandColor(output.qualityScore.band)}>
                      {output.qualityScore.band.toUpperCase()}
                    </b>
                  </p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {output.provider} · {output.model}
              </span>
            </div>
            {/* Pillar bars */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(['clarity', 'eeat', 'qa', 'structure', 'structuredData'] as const).map((key) => {
                const p = output.qualityScore.pillars[key]
                const colour =
                  p.score >= 75 ? 'bg-emerald-500' : p.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                return (
                  <div key={key} className="bg-input/30 rounded-lg border border-input px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {key === 'structuredData' ? 'Struct. Data' : key}
                    </p>
                    <p className="text-xl font-black text-foreground">{p.score}</p>
                    <div className="mt-1 h-1 rounded-full bg-border">
                      <div
                        className={cn('h-full rounded-full', colour)}
                        style={{ width: `${p.score}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            {output.qualityScore.topRecommendations.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t('top_recommendations')}
                </p>
                {output.qualityScore.topRecommendations.map((r, i) => (
                  <p
                    key={i}
                    className="bg-input/30 rounded border border-input px-2 py-1 text-[11px] text-foreground"
                  >
                    · {r}
                  </p>
                ))}
              </div>
            )}
          </Card>

          {/* Markdown output */}
          <Card className="p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-foreground">{t('generated_article')}</p>
              <div className="flex items-center gap-2">
                <Button onClick={copyMarkdown} size="sm" variant="outline">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? t('copied') : t('copy')}
                </Button>
                <Button onClick={downloadMarkdown} size="sm" variant="outline">
                  <Download className="h-3.5 w-3.5" />
                  {t('download_md')}
                </Button>
                <Button onClick={generate} size="sm" disabled={loading}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t('regenerate')}
                </Button>
              </div>
            </div>
            <pre className="bg-input/40 max-h-[600px] overflow-auto rounded-lg border border-input p-4 text-xs text-foreground">
              {output.markdown}
            </pre>
          </Card>
        </>
      )}
    </div>
  )
}
