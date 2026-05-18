import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Badge ────────────────────────────────────────────────────────────────────

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest',
  {
    variants: {
      variant: {
        default: 'bg-surface-input text-text-secondary-surface border border-surface-input-border',
        brand:
          'bg-brand-100 text-brand border border-brand-200 dark:bg-brand-500/20 dark:text-brand-400 dark:border-brand-500/30',
        success:
          'bg-success-100 text-success-700 border border-success-300 dark:bg-success-500/20 dark:text-success-400 dark:border-success-500/30',
        warning:
          'bg-warning-100 text-warning-700 border border-warning-300 dark:bg-warning-500/20 dark:text-warning-400 dark:border-warning-500/30',
        danger:
          'bg-error-100 text-error-700 border border-error-300 dark:bg-error-500/20 dark:text-error-400 dark:border-error-500/30',
        info: 'bg-info-100 text-info-700 border border-info-300 dark:bg-info-500/20 dark:text-info-400 dark:border-info-500/30',
        purple:
          'bg-primary-100 text-primary-700 border border-primary-300 dark:bg-primary-500/20 dark:text-primary-400 dark:border-primary-500/30',
        outline: 'border border-surface-input-border text-text-secondary-surface bg-transparent',
      },
      size: {
        sm: 'text-[9px] px-1.5 py-0',
        md: 'text-[10px] px-2 py-0.5',
        lg: 'text-xs px-3 py-1',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean
}

const Badge: React.FC<BadgeProps> = ({
  className,
  variant,
  size,
  dot = false,
  children,
  ...props
}) => (
  <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
    {dot && <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />}
    {children}
  </span>
)

// ─── Spinner ──────────────────────────────────────────────────────────────────

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className }) => {
  const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' }
  return <Loader2 className={cn('animate-spin text-brand', sizes[size], className)} />
}

// ─── Input ────────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftElement?: React.ReactNode
  rightElement?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftElement, rightElement, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            className="text-text-muted-surface block text-xs font-bold uppercase tracking-widest"
            htmlFor={inputId}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftElement && (
            <div className="text-text-muted-surface pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
              {leftElement}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'border-surface-input-border bg-surface-input text-text-on-surface placeholder-text-muted-surface w-full rounded-xl border px-4 py-3 text-sm',
              'outline-none transition-all',
              'focus:ring-brand/20 focus:border-brand focus:ring-2',
              error ? 'border-error-500 focus:border-error-500 focus:ring-error-500/20' : '',
              leftElement && 'pl-10',
              rightElement && 'pr-10',
              className,
            )}
            {...props}
          />
          {rightElement && (
            <div className="text-text-muted-surface absolute right-3 top-1/2 -translate-y-1/2">
              {rightElement}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-text-muted-surface text-xs">{hint}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'

// ─── Textarea ─────────────────────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            className="text-text-muted-surface block text-xs font-bold uppercase tracking-widest"
            htmlFor={inputId}
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'border-surface-input-border bg-surface-input text-text-on-surface flex min-h-[80px] w-full rounded-xl border px-4 py-3 text-sm',
            'outline-none transition-all',
            'focus:ring-brand/20 focus:border-brand focus:ring-2',
            error && 'border-error-500',
            className,
          )}
          {...props}
        />
        {error && <p className="text-error-500 text-xs">{error}</p>}
        {hint && !error && <p className="text-text-muted-surface text-xs">{hint}</p>}
      </div>
    )
  },
)
Textarea.displayName = 'Textarea'

// ─── Select ─────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: { value: string; label: string; disabled?: boolean }[]
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, id, options, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            className="text-text-muted-surface block text-xs font-bold uppercase tracking-widest"
            htmlFor={inputId}
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'border-surface-input-border bg-surface-input text-text-on-surface w-full appearance-none rounded-xl border px-4 py-3 text-sm',
            'outline-none transition-all',
            'focus:ring-brand/20 focus:border-brand focus:ring-2',
            error && 'border-error-500',
            className,
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} disabled={opt.disabled} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-error-500 text-xs">{error}</p>}
        {hint && !error && <p className="text-text-muted-surface text-xs">{hint}</p>}
      </div>
    )
  },
)
Select.displayName = 'Select'

// ─── Exports ──────────────────────────────────────────────────────────────────

export { Badge, badgeVariants, Spinner, Input, Textarea, Select }
