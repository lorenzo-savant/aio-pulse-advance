// PATH: src/app/dashboard/fan-out/page.tsx
//
// Query Fan-out — the searches the engines actually ran.
//
// The ranking is deliberately ordered "most run, least mentioned first": a
// search the engines run constantly and where the brand rarely appears is the
// gap worth work. Coverage is stated on the page rather than implied, because
// a ranking built on a third of the runs must not look like a ranking built on
// all of them.

'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Search, AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

interface BrandLite {
  id: string
  name: string
}

interface FanOutQueryStat {
  query: string
  runs: number
  engines: string[]
  mentionRate: number
  citationRate: number
  prompts: string[]
  drift: number
}

interface FanOutData {
  captured: number
  notCaptured: number
  searchless: number
  expansionRatio: number
  queries: FanOutQueryStat[]
  windowDays: number
  totalRows: number
}

function Stat({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-3xl font-black tabular-nums tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
      {hint && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </Card>
  )
}

export default function FanOutPage() {
  const t = useTranslations('fan_out')
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [selected, setSelected] = useState<BrandLite | null>(null)
  const [data, setData] = useState<FanOutData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/brands')
      .then((r) => r.json())
      .then((j: { data?: BrandLite[] }) => {
        if (cancelled) return
        const list = j.data ?? []
        setBrands(list)
        if (list[0]) setSelected(list[0])
        else setLoading(false)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load brands')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    if (!selected) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/fan-out?brand_id=${selected.id}&days=30`)
      const json = (await res.json()) as { success?: boolean; data?: FanOutData; message?: string }
      if (!res.ok || !json.success) {
        setError(json.message || `Request failed (${res.status})`)
        setData(null)
        return
      }
      setData(json.data ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }, [selected])

  useEffect(() => {
    load()
  }, [load])

  const hasAny = (data?.captured ?? 0) > 0

  return (
    <div className="animate-in space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight text-foreground">
            <Search className="h-6 w-6 text-brand" />
            {t('page_title')}
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">{t('page_subtitle')}</p>
        </div>
        {brands.length > 1 && (
          <select
            className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            value={selected?.id ?? ''}
            onChange={(e) => {
              const b = brands.find((x) => x.id === e.target.value)
              if (b) setSelected(b)
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

      <Card className="border-l-4 border-l-brand p-5">
        <h2 className="text-sm font-bold text-foreground">{t('why_title')}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {t('why_body')}
        </p>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && error && (
        <Card className="flex items-start gap-3 p-6 text-sm text-rose-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </Card>
      )}

      {!loading && !error && data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat value={String(data.captured)} label={t('captured')} />
            <Stat
              value={String(data.notCaptured)}
              label={t('not_captured')}
              hint={t('not_captured_hint')}
            />
            <Stat
              value={String(data.searchless)}
              label={t('searchless')}
              hint={t('searchless_hint')}
            />
            <Stat
              value={data.expansionRatio ? data.expansionRatio.toFixed(1) : '—'}
              label={t('expansion')}
              hint={t('expansion_hint')}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {t('window', { days: data.windowDays })} · {t('coverage')}: {data.captured}/
            {data.totalRows}
          </p>

          {!hasAny ? (
            <Card className="p-8 text-center">
              <p className="text-lg font-bold text-foreground">{t('empty_title')}</p>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {t('empty_body')}
              </p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-4 py-3 font-medium text-muted-foreground">
                        {t('table_query')}
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        {t('table_runs')}
                      </th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">
                        {t('table_engines')}
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        {t('table_mention')}
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        {t('table_citation')}
                      </th>
                      <th
                        className="px-4 py-3 text-right font-medium text-muted-foreground"
                        title={t('drift_hint')}
                      >
                        {t('table_drift')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.queries.map((q) => (
                      <tr key={q.query} className="border-border/50 border-b align-top">
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground">{q.query}</span>
                          {q.prompts[0] && (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {t('triggered_by')}: {q.prompts[0]}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground">
                          {q.runs}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {q.engines.join(' · ')}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-3 text-right tabular-nums',
                            q.mentionRate === 0 ? 'text-rose-400' : 'text-foreground',
                          )}
                        >
                          {q.mentionRate}%
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {q.citationRate}%
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {q.drift}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
