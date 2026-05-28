'use client'

import { cn } from '@/lib/utils'

interface AioLogoProps {
  /** Size in px for the mark. Wordmark scales accordingly. */
  size?: number
  /** Hide the "AIO PULSE" wordmark and render only the mark. */
  markOnly?: boolean
  /** Color tint for the wordmark. Defaults to `text-foreground`. */
  textClassName?: string
  className?: string
}

/**
 * AIO Pulse logo. The mark is a heartbeat-driven waveform inside a ring of
 * concentric pulse waves — it visually "beats" (lub-dub) once per cycle, which
 * is the core brand metaphor.
 */
export function AioLogo({ size = 36, markOnly = false, textClassName, className }: AioLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className="aio-logo relative inline-flex shrink-0 items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="aio-logo__ring aio-logo__ring--1" aria-hidden="true" />
        <span className="aio-logo__ring aio-logo__ring--2" aria-hidden="true" />
        <svg
          viewBox="0 0 48 48"
          className="aio-logo__mark relative h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="aio-logo-fill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="oklch(var(--color-accent))" />
              <stop offset="100%" stopColor="oklch(0.42 0.22 295)" />
            </linearGradient>
            <linearGradient id="aio-logo-wave" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="oklch(0.99 0 0)" stopOpacity="0.4" />
              <stop offset="50%" stopColor="oklch(0.99 0 0)" stopOpacity="1" />
              <stop offset="100%" stopColor="oklch(0.99 0 0)" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r="22" fill="url(#aio-logo-fill)" />
          <path
            className="aio-logo__beat"
            d="M6 24 L14 24 L17 18 L21 30 L24 14 L27 30 L31 22 L34 24 L42 24"
            stroke="url(#aio-logo-wave)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle className="aio-logo__pulse-dot" cx="24" cy="24" r="2" fill="oklch(0.99 0 0)" />
        </svg>
      </span>
      {!markOnly && (
        <span
          className={cn(
            'aio-logo__word font-display font-black tracking-tight',
            textClassName ?? 'text-foreground',
          )}
          style={{ fontSize: size * 0.5 }}
        >
          AIO<span className="aio-logo__word-accent">Pulse</span>
        </span>
      )}
    </span>
  )
}
