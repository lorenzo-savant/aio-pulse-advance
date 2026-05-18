'use client'

import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  color?: 'brand' | 'success' | 'error' | 'warning'
}

const colorMap = {
  brand: 'bg-brand-gradient',
  success: 'bg-gradient-to-br from-success to-emerald-600',
  error: 'bg-gradient-to-br from-error to-red-600',
  warning: 'bg-gradient-to-br from-warning to-amber-600',
}

export function StatCard({ label, value, icon: Icon, color = 'brand' }: StatCardProps) {
  return (
    <div className="stat-card card-horizon">
      <div className={cn('stat-icon', colorMap[color])}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-[34px] font-bold leading-none tracking-tight text-foreground">{value}</p>
      </div>
    </div>
  )
}
