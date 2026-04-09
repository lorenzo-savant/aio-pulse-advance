'use client'

import { ChartSkeleton, StatsCardSkeleton, CardSkeleton } from '@/components/ui/Skeleton'

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <CardSkeleton />
    </div>
  )
}
