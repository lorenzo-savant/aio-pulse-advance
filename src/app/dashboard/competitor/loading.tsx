'use client'

import { ChartSkeleton, CardSkeleton } from '@/components/ui/Skeleton'

export default function CompetitorLoading() {
  return (
    <div className="space-y-6">
      <ChartSkeleton />
      <CardSkeleton />
    </div>
  )
}
