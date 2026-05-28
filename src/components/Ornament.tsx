'use client'

import { cn } from '@/lib/utils'

interface OrnamentProps {
  variant: 'orbit' | 'blob' | 'burst'
  className?: string
}

export function Ornament({ variant, className }: OrnamentProps) {
  if (variant === 'orbit') {
    return (
      <svg
        viewBox="0 0 240 240"
        className={cn('aio-ornament aio-ornament--orbit', className)}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="aio-orbit-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(var(--color-accent))" stopOpacity="0.32" />
            <stop offset="70%" stopColor="oklch(var(--color-accent))" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="120" cy="120" r="110" fill="url(#aio-orbit-glow)" />

        <g className="aio-ornament__spin" style={{ transformOrigin: '120px 120px' }}>
          <polygon
            points="120,30 200,160 40,160"
            fill="none"
            stroke="oklch(var(--color-accent) / 0.55)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeDasharray="6 8"
          />
          <circle cx="120" cy="30" r="5" fill="oklch(var(--color-accent))" />
          <circle cx="200" cy="160" r="4" fill="oklch(0.65 0.2 300)" />
          <circle cx="40" cy="160" r="4" fill="oklch(0.7 0.18 200)" />
        </g>

        <g
          className="aio-ornament__spin aio-ornament__spin--reverse"
          style={{ transformOrigin: '120px 120px' }}
        >
          <rect
            x="65"
            y="65"
            width="110"
            height="110"
            rx="14"
            fill="none"
            stroke="oklch(var(--color-accent) / 0.3)"
            strokeWidth="1"
            strokeDasharray="2 5"
            transform="rotate(15 120 120)"
          />
          <circle cx="175" cy="65" r="3.5" fill="oklch(var(--color-accent))" />
          <circle cx="65" cy="175" r="3.5" fill="oklch(0.65 0.2 300)" />
        </g>
      </svg>
    )
  }

  if (variant === 'blob') {
    return (
      <svg
        viewBox="0 0 200 200"
        className={cn('aio-ornament aio-ornament--blob', className)}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="aio-blob-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(var(--color-accent))" stopOpacity="0.5" />
            <stop offset="100%" stopColor="oklch(0.7 0.18 300)" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="aio-blob-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(var(--color-accent))" stopOpacity="0.7" />
            <stop offset="100%" stopColor="oklch(0.6 0.22 295)" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <g className="aio-ornament__morph" style={{ transformOrigin: '100px 100px' }}>
          <polygon
            points="100,18 158,40 184,98 162,160 100,182 38,160 16,98 42,40"
            fill="url(#aio-blob-grad)"
            stroke="url(#aio-blob-stroke)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <polygon
            points="100,45 138,57 156,98 138,142 100,156 62,142 44,98 62,57"
            fill="none"
            stroke="oklch(var(--color-accent) / 0.35)"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
        </g>
      </svg>
    )
  }

  // burst — constellation pattern (nodes + chords) instead of symmetric rays
  const nodes = [
    { x: 100, y: 24 },
    { x: 168, y: 56 },
    { x: 182, y: 132 },
    { x: 130, y: 178 },
    { x: 58, y: 168 },
    { x: 22, y: 108 },
    { x: 44, y: 42 },
  ]
  return (
    <svg
      viewBox="0 0 200 200"
      className={cn('aio-ornament aio-ornament--burst', className)}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="aio-burst-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="oklch(var(--color-accent))" stopOpacity="0.55" />
          <stop offset="100%" stopColor="oklch(var(--color-accent))" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="78" fill="url(#aio-burst-glow)" />
      <g className="aio-ornament__pulse" style={{ transformOrigin: '100px 100px' }}>
        {nodes.map((n, i) => {
          const next = nodes[(i + 2) % nodes.length]
          if (!next) return null
          return (
            <line
              key={`chord-${i}`}
              x1={n.x}
              y1={n.y}
              x2={next.x}
              y2={next.y}
              stroke="oklch(var(--color-accent) / 0.55)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          )
        })}
        {nodes.map((n, i) => (
          <circle
            key={`node-${i}`}
            cx={n.x}
            cy={n.y}
            r={i % 2 === 0 ? 4.5 : 3}
            fill={i % 3 === 0 ? 'oklch(0.65 0.2 300)' : 'oklch(var(--color-accent))'}
          />
        ))}
        <circle cx="100" cy="100" r="6" fill="oklch(var(--color-accent))" />
        <circle
          cx="100"
          cy="100"
          r="10"
          fill="none"
          stroke="oklch(var(--color-accent) / 0.5)"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
      </g>
    </svg>
  )
}
