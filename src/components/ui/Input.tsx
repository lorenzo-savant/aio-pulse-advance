'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, icon, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-text-secondary-surface">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <span className="text-text-muted-surface">{icon}</span>
            </div>
          )}
          <input
            type={type}
            className={cn(
              'flex h-10 w-full rounded-lg border border-surface-input-border bg-surface-input px-3 py-2 text-sm text-text-on-surface outline-none transition-all placeholder:text-text-muted-surface',
              'focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20',
              'disabled:cursor-not-allowed disabled:opacity-50',
              icon && 'pl-10',
              error && 'border-error-500 focus:border-error-500 focus:ring-error-500/10',
              className,
            )}
            ref={ref}
            {...props}
          />
        </div>
        {error && <p className="mt-1.5 text-xs text-error-500">{error}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'

export { Input }
