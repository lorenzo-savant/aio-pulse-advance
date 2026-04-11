'use client'

import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { useMemo, useEffect, useState } from 'react'
import type { ApexOptions } from 'apexcharts'
import {
  getHorizonChartOptions,
  getHorizonBarOptions,
  getHorizonLineOptions,
  getHorizonPieOptions,
} from '@/lib/apex-theme'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

type ChartVariant = 'line' | 'bar' | 'area' | 'donut' | 'pie'

interface HorizonChartProps {
  variant?: ChartVariant
  series: ApexAxisChartSeries | ApexNonAxisChartSeries
  categories?: string[]
  labels?: string[]
  height?: number | string
  overrides?: ApexOptions
  className?: string
}

export function HorizonChart({
  variant = 'area',
  series,
  categories,
  labels,
  height = 350,
  overrides = {},
  className,
}: HorizonChartProps) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = theme === 'dark'

  const options = useMemo<ApexOptions>(() => {
    let base: ApexOptions
    switch (variant) {
      case 'bar':
        base = getHorizonBarOptions(isDark)
        break
      case 'line':
        base = getHorizonLineOptions(isDark)
        break
      case 'donut':
      case 'pie':
        base = getHorizonPieOptions(isDark)
        break
      default:
        base = getHorizonChartOptions(isDark)
    }

    return {
      ...base,
      ...overrides,
      chart: { ...base.chart, ...(overrides.chart || {}) },
      xaxis: {
        ...base.xaxis,
        ...(overrides.xaxis || {}),
        categories: categories || (overrides.xaxis as any)?.categories,
      },
      labels: labels || overrides.labels || base.labels,
    }
  }, [isDark, variant, categories, labels, overrides])

  if (!mounted) {
    return <div className={`h-[${height}px] animate-pulse rounded-xl bg-secondary`} />
  }

  const chartType = variant === 'donut' ? 'donut' : variant === 'pie' ? 'pie' : variant

  return (
    <div className={className}>
      <ReactApexChart
        options={options}
        series={series}
        type={chartType}
        height={height}
        width="100%"
      />
    </div>
  )
}
