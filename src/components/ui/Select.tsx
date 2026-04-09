'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: Array<{ value: string; label: string }>
  placeholder?: string
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-text-secondary-surface">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            className={cn(
              'flex h-11 w-full appearance-none rounded-xl border border-surface-input-border bg-surface-input px-4 py-2 pr-10 text-sm text-text-on-surface outline-none transition-all',
              'focus:border-primary-600 focus:ring-1 focus:ring-primary-600/20',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-error-500 focus:border-error-500 focus:ring-error-500/10',
              className,
            )}
            ref={ref}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted-surface" />
        </div>
        {error && <p className="mt-1.5 text-xs text-error-500">{error}</p>}
      </div>
    )
  },
)
Select.displayName = 'Select'

export { Select }
