import * as React from 'react'
import { cn } from '@/lib/utils'

// ─── Root ─────────────────────────────────────────────────────────────────────

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Remove default padding */
  noPadding?: boolean
  /** Add hover border highlight */
  interactive?: boolean
  /** Add a brand glow on hover */
  glow?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, glow = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative overflow-hidden rounded-xl border border-nav-border bg-page-bg-elevated text-text-on-surface',
        'shadow-lg',
        'transition-all duration-200 ease-out',
        interactive &&
          'card-wiggle cursor-pointer hover:-translate-y-1 hover:border-primary-600 hover:shadow-xl',
        glow && 'hover:shadow-[0_0_20px_-5px_rgb(91_79_216/0.3)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
)
Card.displayName = 'Card'

// ─── Header ───────────────────────────────────────────────────────────────────

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  action?: React.ReactNode
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, title, description, action, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-start justify-between gap-4 px-6 pt-6', className)}
      {...props}
    >
      {(title ?? description ?? children) && (
        <div className="flex-1">
          {title && <h3 className="text-lg font-bold text-text-on-surface">{title}</h3>}
          {description && <p className="mt-1 text-sm text-text-secondary-surface">{description}</p>}
          {children}
        </div>
      )}
      {action && <div className="shrink-0">{action}</div>}
    </div>
  ),
)
CardHeader.displayName = 'CardHeader'

// ─── Body ─────────────────────────────────────────────────────────────────────

const CardBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-6 py-6', className)} {...props} />
  ),
)
CardBody.displayName = 'CardBody'

// ─── Footer ───────────────────────────────────────────────────────────────────

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center border-t border-nav-border px-6 py-4', className)}
      {...props}
    />
  ),
)
CardFooter.displayName = 'CardFooter'

// ─── Divider ──────────────────────────────────────────────────────────────────

const CardDivider: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('border-t border-nav-border', className)} />
)

export { Card, CardHeader, CardBody, CardFooter, CardDivider }
