'use client'

import { ChartSkeleton, StatsCardSkeleton } from '@/components/ui/Skeleton'

export default function SentimentLoading() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
      </div>
      <ChartSkeleton />
    </div>
  )
}
