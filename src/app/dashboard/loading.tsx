import { StatsCardSkeleton, ChartSkeleton, ListSkeleton } from '@/components/ui/Skeleton'

// Generic dashboard-shell skeleton. Applies as the App Router fallback for
// any dashboard route that doesn't ship its own loading.tsx, so cold
// navigations land on a structured shell instead of a blank screen.
//
// Per-route loading.tsx files (alerts/, analytics/, brands/, citations/,
// competitor/, optimizer/, sentiment/) override this with richer
// skeletons matching their specific layout.
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
      </div>
      <ChartSkeleton />
      <ListSkeleton count={6} />
    </div>
  )
}
