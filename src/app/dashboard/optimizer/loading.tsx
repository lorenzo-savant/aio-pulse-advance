'use client'

import { CardSkeleton, ChartSkeleton } from '@/components/ui/Skeleton'

export default function OptimizerLoading() {
  return (
    <div className="space-y-6">
      <CardSkeleton />
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  )
}
