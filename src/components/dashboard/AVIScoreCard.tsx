'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'

interface AVIData {
  avi: number
  delta: number
  components: {
    citationRate: number
    mentionRate: number
    sentimentScore: number
    recommendationRate: number
    positionAvg: number
    hallucinationRate: number
  }
  previousAvi: number
  date?: string
}

const COMPONENT_CONFIG = [
  { key: 'citationRate' as const, label: 'Citation Rate', weight: '20%' },
  { key: 'mentionRate' as const, label: 'Mention Rate', weight: '20%' },
  { key: 'recommendationRate' as const, label: 'Recommendation', weight: '20%' },
  {
    key: 'sentimentScore' as const,
    label: 'Sentiment',
    weight: '15%',
    normalize: (v: number) => ((v + 1) / 2) * 100,
  },
  {
    key: 'positionAvg' as const,
    label: 'Position',
    weight: '15%',
    normalize: (v: number) => (v <= 0 ? 50 : Math.max(0, ((5 - v) / 4) * 100)),
  },
  {
    key: 'hallucinationRate' as const,
    label: 'Anti-Hallucination',
    weight: '10%',
    normalize: (v: number) => Math.max(0, 100 - v),
  },
]

function getScoreColor(score: number): string {
  if (score >= 60) return 'text-green-500'
  if (score >= 30) return 'text-yellow-500'
  return 'text-red-500'
}

function getBarColor(score: number): string {
  if (score >= 60) return 'bg-green-500'
  if (score >= 30) return 'bg-yellow-500'
  return 'bg-red-500'
}

export function AVIScoreCard({ brandId }: { brandId?: string }) {
  const [data, setData] = useState<AVIData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams()
    if (brandId) params.set('brandId', brandId)

    fetch(`/api/analytics/avi?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [brandId])

  if (loading) {
    return (
      <Card className="animate-pulse p-6">
        <div className="bg-foreground/5 h-40 rounded" />
      </Card>
    )
  }

  if (!data) return null

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-foreground/60 text-sm font-medium">AI Visibility Index</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`text-4xl font-bold ${getScoreColor(data.avi)}`}>
              {data.avi.toFixed(1)}
            </span>
            <span className="text-foreground/40 text-sm">/100</span>
          </div>
        </div>
        {data.delta !== 0 && (
          <div
            className={`flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium ${
              data.delta > 0
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            <span>{data.delta > 0 ? '↑' : '↓'}</span>
            <span>{Math.abs(data.delta).toFixed(1)}</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {COMPONENT_CONFIG.map((comp) => {
          const rawValue = data.components[comp.key]
          const normalized = comp.normalize ? comp.normalize(rawValue) : rawValue
          const percentage = Math.max(0, Math.min(100, normalized))

          return (
            <div key={comp.key}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-foreground/60">
                  {comp.label} <span className="opacity-50">({comp.weight})</span>
                </span>
                <span className="font-medium">{percentage.toFixed(0)}%</span>
              </div>
              <div className="bg-foreground/10 h-2 overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getBarColor(percentage)}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {data.date && (
        <p className="text-foreground/40 mt-4 text-xs">
          Last updated: {new Date(data.date).toLocaleDateString()}
        </p>
      )}
    </Card>
  )
}
