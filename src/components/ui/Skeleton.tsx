// PATH: src/components/ui/Skeleton.tsx
import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('bg-surface-700 animate-pulse rounded-md', className)} />
}

export function CardSkeleton() {
  return (
    <div className="border-surface-700 rounded-2xl border bg-surface-800/50 p-6">
      <Skeleton className="mb-4 h-4 w-1/3" />
      <Skeleton className="mb-4 h-20 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  )
}

export function TableRowSkeleton() {
  return (
    <div className="border-surface-700 flex items-center gap-4 border-b py-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-8 w-16" />
    </div>
  )
}

export function StatsCardSkeleton() {
  return (
    <div className="border-surface-700 rounded-2xl border bg-surface-800/50 p-6">
      <div className="mb-4 flex items-start justify-between">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <Skeleton className="mb-2 h-3 w-1/2" />
      <Skeleton className="h-8 w-1/3" />
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="border-surface-700 rounded-2xl border bg-surface-800/50 p-6">
      <Skeleton className="mb-6 h-6 w-1/3" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <TableRowSkeleton key={i} />
      ))}
    </div>
  )
}
