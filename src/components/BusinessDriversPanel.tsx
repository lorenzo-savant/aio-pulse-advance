'use client'

// "Key Business Drivers" panel — brand × attribute heatmap with a
// trophy on each driver's leader, plus a "narrative gaps" punch-list.
//
// Closes the gap from the industry research "Brand Performance" piece:
//   "The Key Business Drivers heatmap shows which attributes — pricing,
//    fulfillment speed, product assortment, ease of use — AI mentions
//    most often for each brand in your category. Notice the trophy icon
//    marking the leader for each driver. Scan for topics where
//    competitors have the trophy and your brand ranks low. These are
//    your narrative gaps."
//
// Self-contained: own brand list, own fetch, hides when there's no
// monitoring data to mine.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Trophy, Loader2, AlertTriangle } from 'lucide-react'

type DriverId =
  | 'pricing'
  | 'speed'
  | 'quality'
  | 'support'
  | 'features'
  | 'value'
  | 'reliability'
  | 'ease_of_use'

interface DriverDefinition {
  id: DriverId
  label: string
  keywords: string[]
}

interface DriverScore {
  brand: string
  isBrand: boolean
  mentions: number
  share: number
}

interface DriverColumn {
  driver: DriverDefinition
  totalMentions: number
  leader: DriverScore | null
  rows: DriverScore[]
}

interface BusinessDriversReport {
  drivers: DriverColumn[]
  totalResponses: number
  brands: Array<{ name: string; isBrand: boolean; totalMentions: number }>
}

interface NarrativeGap {
  driver: DriverDefinition
  leader: DriverScore
  brand: DriverScore | null
  gap: number
}

interface ResponseData {
  report: BusinessDriversReport
  gaps: NarrativeGap[]
  filters: { days: number }
}

interface BrandLite {
  id: string
  name: string
}

/** Heatmap cell colour — emerald for brand, neutral grey for others, intensity by share. */
function cellColour(score: DriverScore): string {
  const s = score.share
  if (s === 0) return 'bg-secondary/20 text-muted-foreground'
  const tone = score.isBrand ? 'emerald' : 'slate'
  if (s < 15) return `bg-${tone}-500/10 text-foreground`
  if (s < 30) return `bg-${tone}-500/25 text-foreground`
  if (s < 50) return `bg-${tone}-500/45 text-white`
  if (s < 70) return `bg-${tone}-500/65 text-white`
  return `bg-${tone}-500/85 text-white`
}

export function BusinessDriversPanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [data, setData] = useState<ResponseData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync internal state when parent changes the brand prop.
  useEffect(() => {
    if (brandIdProp) setActiveBrandId(brandIdProp)
  }, [brandIdProp])

  useEffect(() => {
    if (brandIdProp) return
    let cancelled = false
    fetch('/api/brands')
      .then((r) => r.json() as Promise<{ data?: BrandLite[] }>)
      .then((j) => {
        if (cancelled) return
        const list = j.data ?? []
        setBrands(list)
        if (!activeBrandId && list[0]) setActiveBrandId(list[0].id)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandIdProp])

  useEffect(() => {
    if (!activeBrandId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/competitor/business-drivers?brand_id=${activeBrandId}&days=30`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.success) setData(j.data as ResponseData)
        else setError(j.message || 'Failed to load')
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeBrandId])

  if (loading && !data) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Loading business drivers…
      </Card>
    )
  }
  if (error) return <Card className="p-6 text-sm text-rose-400">{error}</Card>
  if (!data || data.report.brands.length === 0) return null
  if (data.report.drivers.every((d) => d.totalMentions === 0)) return null

  // Cap displayed brands to keep the heatmap legible — brand always
  // first, then top 5 competitors by total mentions.
  const displayedBrands = data.report.brands.slice(0, 6)

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Key Business Drivers</h2>
        </div>
        {brands.length > 1 && !brandIdProp && (
          <select
            value={activeBrandId}
            onChange={(e) => setActiveBrandId(e.target.value)}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground"
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Of the {data.report.totalResponses} AI responses analysed (last {data.filters.days} days),
        which brand owns each narrative attribute? The trophy marks the leader per driver. Cells
        show the % share of mentions for that brand × driver pair.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2 pr-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Driver
              </th>
              {displayedBrands.map((b) => (
                <th
                  key={b.name}
                  className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  title={`${b.totalMentions} total mentions across drivers`}
                >
                  <span className={b.isBrand ? 'font-bold text-brand' : ''}>{b.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.report.drivers.map((col) => {
              if (col.totalMentions === 0) return null
              return (
                <tr key={col.driver.id} className="border-t border-border">
                  <td className="py-2 pr-3 text-sm font-semibold text-foreground">
                    {col.driver.label}
                  </td>
                  {displayedBrands.map((b) => {
                    const score = col.rows.find((r) => r.brand === b.name)
                    const isLeader =
                      col.leader && col.leader.brand === b.name && col.leader.mentions > 0
                    if (!score) return <td key={b.name} className="px-2 py-2" />
                    return (
                      <td
                        key={b.name}
                        className={`px-2 py-2 text-center text-xs font-bold ${cellColour(score)}`}
                        title={`${score.mentions} mentions — ${score.share}%`}
                      >
                        {isLeader && <Trophy className="mr-0.5 inline h-3 w-3 text-amber-400" />}
                        {score.share > 0 ? `${score.share}%` : '·'}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {data.gaps.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-rose-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Narrative gaps — drivers a competitor owns
          </p>
          <div className="space-y-1">
            {data.gaps.slice(0, 6).map((g) => (
              <div
                key={g.driver.id}
                className="bg-input/40 flex items-center justify-between gap-2 rounded-md border border-input px-3 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{g.driver.label}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {g.leader.brand} leads with{' '}
                    <span className="font-bold">{g.leader.mentions}</span> mention
                    {g.leader.mentions === 1 ? '' : 's'}
                  </span>
                </div>
                <span className="shrink-0 text-[11px] text-rose-300">gap −{g.gap}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
