import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'link'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'icon'

// ─── Variants ─────────────────────────────────────────────────────────────────

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'font-semibold rounded-md',
    'transition-all duration-200 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-brand-gradient text-white shadow-md hover:shadow-lg hover:brightness-110 active:brightness-95',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-surface-300 dark:hover:bg-surface-300',
        outline: 'border border-border bg-transparent text-foreground hover:bg-secondary',
        ghost: 'bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground',
        danger: 'bg-error text-error-foreground hover:opacity-90 active:opacity-80',
        success: 'bg-success text-success-foreground hover:opacity-90 active:opacity-80',
        link: 'h-auto p-0 text-brand underline-offset-4 hover:underline hover:text-brand-hover',
      },
      size: {
        xs: 'h-7 px-2.5 text-xs gap-1',
        sm: 'h-8 px-3 text-sm gap-1.5',
        md: 'h-10 px-4 py-2.5 text-sm gap-2',
        lg: 'h-12 px-6 text-base gap-2',
        xl: 'h-14 px-8 text-lg gap-3',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render as child component (Radix Slot) */
  asChild?: boolean
  /** Show loading spinner and disable interaction */
  loading?: boolean
  /** Icon to render on the left */
  leftIcon?: React.ReactNode
  /** Icon to render on the right */
  rightIcon?: React.ReactNode
}

// ─── Component ────────────────────────────────────────────────────────────────

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled ?? loading}
        {...props}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : leftIcon}
        {children}
        {!loading && rightIcon}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
