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

import { Fragment, useCallback, useEffect, useState } from 'react'
import { Loader2, Search, AlertCircle, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
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

interface FanOutRun {
  id: string
  engine: string
  createdAt: string | null
  prompt: string
  searchQueries: string[]
  answer: string
  truncated: boolean
  citedUrls: string[]
  brandMentioned: boolean
  ownDomainCited: boolean
}

/** Per-query drill-down state. Kept in a map keyed by the query so reopening a
 *  row is instant and does not refetch what was already read. */
interface RunsState {
  loading: boolean
  error: string | null
  runs: FanOutRun[]
  total: number
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

/** Same folding the server groups by (fanOutKey), so the row a user clicks
 *  and the cache entry it fills are keyed identically. */
function queryKey(q: string): string {
  return q.trim().toLowerCase().replace(/s+/g, ' ')
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www./i, '')
  } catch {
    return url
  }
}

export default function FanOutPage() {
  const t = useTranslations('fan_out')
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [selected, setSelected] = useState<BrandLite | null>(null)
  const [data, setData] = useState<FanOutData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [runs, setRuns] = useState<Record<string, RunsState>>({})

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

  // Switching brand invalidates every cached drill-down: the runs belong to
  // the brand, not to the search string.
  useEffect(() => {
    setRuns({})
    setExpanded(null)
  }, [selected?.id])

  const toggleQuery = useCallback(
    async (query: string) => {
      const key = queryKey(query)
      if (expanded === key) {
        setExpanded(null)
        return
      }
      setExpanded(key)
      // Already read once: reopening a row must not re-hit the API.
      if (!selected || runs[key]) return
      setRuns((prev) => ({ ...prev, [key]: { loading: true, error: null, runs: [], total: 0 } }))

      const fail = (message: string) =>
        setRuns((prev) => ({
          ...prev,
          [key]: { loading: false, error: message, runs: [], total: 0 },
        }))

      try {
        const res = await fetch(
          `/api/fan-out/runs?brand_id=${selected.id}&query=${encodeURIComponent(query)}&days=30`,
        )
        const json = (await res.json()) as {
          success?: boolean
          data?: { runs: FanOutRun[]; total: number }
          message?: string
        }
        if (!res.ok || !json.success) {
          fail(json.message || `Request failed (${res.status})`)
          return
        }
        setRuns((prev) => ({
          ...prev,
          [key]: {
            loading: false,
            error: null,
            runs: json.data?.runs ?? [],
            total: json.data?.total ?? 0,
          },
        }))
      } catch (e) {
        fail(e instanceof Error ? e.message : 'Unexpected error')
      }
    },
    [expanded, selected, runs],
  )

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
                    {data.queries.map((q) => {
                      const key = queryKey(q.query)
                      const open = expanded === key
                      const state = runs[key]
                      return (
                        <Fragment key={q.query}>
                          <tr className="border-border/50 border-b align-top">
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => toggleQuery(q.query)}
                                aria-expanded={open}
                                className="flex items-start gap-2 text-left transition-colors hover:text-brand"
                              >
                                {open ? (
                                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                                ) : (
                                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                )}
                                <span>
                                  <span className="font-medium text-foreground">{q.query}</span>
                                  {q.prompts[0] && (
                                    <span className="mt-1 block text-xs text-muted-foreground">
                                      {t('triggered_by')}: {q.prompts[0]}
                                    </span>
                                  )}
                                </span>
                              </button>
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

                          {open && (
                            <tr className="border-border/50 bg-secondary/40 border-b">
                              <td colSpan={6} className="px-4 py-4">
                                {state?.loading && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {t('runs_loading')}
                                  </div>
                                )}

                                {state?.error && (
                                  <div className="flex items-start gap-2 text-sm text-rose-400">
                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>{state.error}</span>
                                  </div>
                                )}

                                {state && !state.loading && !state.error && (
                                  <div className="space-y-4">
                                    <p className="text-xs text-muted-foreground">
                                      {t('runs_shown', {
                                        shown: state.runs.length,
                                        total: state.total,
                                      })}
                                    </p>

                                    {state.runs.length === 0 && (
                                      <p className="text-sm text-muted-foreground">
                                        {t('runs_empty')}
                                      </p>
                                    )}

                                    {state.runs.map((run) => (
                                      <div
                                        key={run.id}
                                        className="rounded-lg border border-border bg-background p-4"
                                      >
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                          <span className="font-semibold text-foreground">
                                            {run.engine}
                                          </span>
                                          {run.createdAt && (
                                            <span className="text-muted-foreground">
                                              {new Date(run.createdAt).toLocaleString()}
                                            </span>
                                          )}
                                          <span
                                            className={cn(
                                              'rounded-full px-2 py-0.5 font-medium',
                                              run.brandMentioned
                                                ? 'bg-emerald-500/15 text-emerald-400'
                                                : 'bg-rose-500/15 text-rose-400',
                                            )}
                                          >
                                            {run.brandMentioned
                                              ? t('run_mentioned')
                                              : t('run_not_mentioned')}
                                          </span>
                                          {run.ownDomainCited && (
                                            <span className="bg-brand/15 rounded-full px-2 py-0.5 font-medium text-brand">
                                              {t('run_own_cited')}
                                            </span>
                                          )}
                                        </div>

                                        {run.searchQueries.length > 0 && (
                                          <div className="mt-3">
                                            <p className="text-xs font-medium text-muted-foreground">
                                              {t('run_sibling_searches')}
                                            </p>
                                            <div className="mt-1 flex flex-wrap gap-1.5">
                                              {run.searchQueries.map((sq, i) => (
                                                <span
                                                  key={`${run.id}-sq-${i}`}
                                                  className={cn(
                                                    'rounded-md px-2 py-0.5 text-xs',
                                                    queryKey(sq) === key
                                                      ? 'bg-brand/15 font-medium text-brand'
                                                      : 'bg-secondary text-muted-foreground',
                                                  )}
                                                >
                                                  {sq}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {run.prompt && (
                                          <p className="mt-3 text-xs text-muted-foreground">
                                            <span className="font-medium">{t('run_prompt')}:</span>{' '}
                                            {run.prompt}
                                          </p>
                                        )}

                                        <div className="mt-3">
                                          <p className="text-xs font-medium text-muted-foreground">
                                            {t('run_answer')}
                                          </p>
                                          <p className="mt-1 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                                            {run.answer || '—'}
                                          </p>
                                          {run.truncated && (
                                            <p className="mt-1 text-xs italic text-muted-foreground">
                                              {t('run_truncated')}
                                            </p>
                                          )}
                                        </div>

                                        <div className="mt-3">
                                          <p className="text-xs font-medium text-muted-foreground">
                                            {t('run_citations')}
                                          </p>
                                          {run.citedUrls.length === 0 ? (
                                            <p className="mt-1 text-xs text-muted-foreground">
                                              {t('run_no_citations')}
                                            </p>
                                          ) : (
                                            <ul className="mt-1 space-y-1">
                                              {run.citedUrls.map((url, i) => (
                                                <li key={`${run.id}-url-${i}`}>
                                                  <a
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer nofollow"
                                                    className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
                                                  >
                                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                                    <span className="font-medium">
                                                      {hostOf(url)}
                                                    </span>
                                                    <span className="break-all text-muted-foreground">
                                                      {url}
                                                    </span>
                                                  </a>
                                                </li>
                                              ))}
                                            </ul>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
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
