'use client'

import { cn } from '@/lib/utils'

interface DateRangeFilterProps {
  value: string
  onChange: (value: string) => void
  options?: { label: string; value: string }[]
  className?: string
}

const DEFAULT_OPTIONS = [
  { label: '7d', value: '7d' },
  { label: '14d', value: '14d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
]

export function DateRangeFilter({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  className,
}: DateRangeFilterProps) {
  return (
    <div className={cn('flex gap-1 rounded-xl bg-secondary p-1', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
            value === opt.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
