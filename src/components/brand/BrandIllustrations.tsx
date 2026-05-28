'use client'

import { cn } from '@/lib/utils'

/* ────────────────────────────────────────────────────────────────────────────
 * Shared SVG primitives — all AIO Pulse illustrations share the same visual
 * vocabulary: rounded rectangles ("dashboards"), pulse waveforms, gauge arcs,
 * nodes, and citation cards. Colors come from CSS vars so light + dark themes
 * just work.
 * ──────────────────────────────────────────────────────────────────────────── */

const ACCENT = 'oklch(var(--color-accent))'
const ACCENT_SOFT = 'oklch(var(--color-accent) / 0.18)'
const ACCENT_GLOW = 'oklch(var(--color-accent) / 0.5)'
const INK = 'oklch(var(--surface-900))'
const SURFACE = 'oklch(var(--card))'
const SURFACE_2 = 'oklch(var(--surface-200))'
const MUTED = 'oklch(var(--muted-foreground))'
const SECOND = 'oklch(0.62 0.22 295)' /* violet companion */

/* ─── HERO ──────────────────────────────────────────────────────────────── */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 420"
      className={cn('aio-illu', className)}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="hero-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={ACCENT_SOFT} />
          <stop offset="100%" stopColor="oklch(0.62 0.22 295 / 0.12)" />
        </linearGradient>
        <linearGradient id="hero-wave" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0" />
          <stop offset="50%" stopColor={ACCENT} stopOpacity="1" />
          <stop offset="100%" stopColor={SECOND} stopOpacity="0" />
        </linearGradient>
        <radialGradient id="hero-orb" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.6" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* background orb */}
      <ellipse cx="260" cy="220" rx="220" ry="180" fill="url(#hero-bg)" />
      <ellipse cx="380" cy="120" rx="80" ry="80" fill="url(#hero-orb)" opacity="0.6" />

      {/* main dashboard card */}
      <rect
        x="70"
        y="80"
        width="380"
        height="240"
        rx="22"
        fill={SURFACE}
        stroke={SURFACE_2}
        strokeWidth="1.5"
      />

      {/* dashboard header */}
      <circle cx="92" cy="104" r="5" fill={ACCENT} />
      <rect x="106" y="100" width="80" height="8" rx="4" fill={INK} opacity="0.85" />
      <rect x="380" y="98" width="58" height="14" rx="7" fill={ACCENT_SOFT} />
      <rect x="389" y="103" width="40" height="4" rx="2" fill={ACCENT} />

      {/* AVI score gauge */}
      <g transform="translate(110, 150)">
        <path
          d="M0,60 A60,60 0 0,1 120,60"
          fill="none"
          stroke={SURFACE_2}
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          className="aio-illu__gauge"
          d="M0,60 A60,60 0 0,1 120,60"
          fill="none"
          stroke={ACCENT}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray="188"
          strokeDashoffset="55"
        />
        <text
          x="60"
          y="56"
          textAnchor="middle"
          fontFamily="Lato, sans-serif"
          fontWeight="900"
          fontSize="26"
          fill={INK}
        >
          82
        </text>
        <text
          x="60"
          y="74"
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
          fontWeight="500"
          fontSize="9"
          fill={MUTED}
        >
          AVI SCORE
        </text>
      </g>

      {/* pulse waveform chart */}
      <g transform="translate(245, 145)">
        <rect x="0" y="0" width="190" height="100" rx="14" fill={ACCENT_SOFT} opacity="0.6" />
        <text
          x="14"
          y="22"
          fontFamily="Inter, sans-serif"
          fontWeight="700"
          fontSize="10"
          fill={INK}
        >
          BRAND PULSE · LIVE
        </text>
        <path
          className="aio-illu__wave"
          d="M14,72 L34,72 L42,52 L52,86 L62,38 L72,82 L82,60 L96,60 L106,46 L120,82 L132,56 L144,72 L176,72"
          fill="none"
          stroke="url(#hero-wave)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle className="aio-illu__wave-tip" cx="176" cy="72" r="3.5" fill={ACCENT} />
      </g>

      {/* engine nodes row */}
      <g transform="translate(90, 270)">
        {['GPT', 'GEM', 'PPX', 'CLA'].map((name, i) => (
          <g key={name} transform={`translate(${i * 92}, 0)`}>
            <rect
              width="80"
              height="32"
              rx="10"
              fill={SURFACE}
              stroke={SURFACE_2}
              strokeWidth="1.2"
            />
            <circle cx="14" cy="16" r="5" fill={i % 2 === 0 ? ACCENT : SECOND}>
              <animate
                attributeName="opacity"
                values="1;0.4;1"
                dur={`${1.6 + i * 0.2}s`}
                repeatCount="indefinite"
              />
            </circle>
            <text
              x="26"
              y="20"
              fontFamily="Inter, sans-serif"
              fontWeight="700"
              fontSize="10"
              fill={INK}
            >
              {name}
            </text>
          </g>
        ))}
      </g>

      {/* radiating rings around heart */}
      <g transform="translate(395, 220)">
        <circle
          className="aio-illu__ring aio-illu__ring--1"
          r="20"
          fill="none"
          stroke={ACCENT_GLOW}
          strokeWidth="1.5"
        />
        <circle
          className="aio-illu__ring aio-illu__ring--2"
          r="20"
          fill="none"
          stroke={ACCENT_GLOW}
          strokeWidth="1.5"
        />
        <circle r="14" fill={ACCENT} />
        <path
          className="aio-illu__heart-beat"
          d="M-9,0 L-4,0 L-1,-6 L3,8 L6,-4 L9,0"
          fill="none"
          stroke="oklch(0.99 0 0)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

/* ─── FEATURE BLOCKS — 4 large illustrations ─────────────────────────────── */

export function AviGaugeIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 320" className={cn('aio-illu', className)} aria-hidden="true">
      <defs>
        <linearGradient id="avi-arc" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={ACCENT} />
          <stop offset="100%" stopColor={SECOND} />
        </linearGradient>
      </defs>
      <rect
        x="30"
        y="20"
        width="340"
        height="280"
        rx="22"
        fill={SURFACE}
        stroke={SURFACE_2}
        strokeWidth="1.5"
      />

      {/* header */}
      <g transform="translate(50, 46)">
        <circle r="5" fill={ACCENT} />
        <text x="14" y="4" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="11" fill={INK}>
          BRAND OVERVIEW · LIVE
        </text>
      </g>

      {/* gauge */}
      <g transform="translate(200, 180)">
        <path
          d="M-90,0 A90,90 0 0,1 90,0"
          fill="none"
          stroke={SURFACE_2}
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          className="aio-illu__gauge"
          d="M-90,0 A90,90 0 0,1 90,0"
          fill="none"
          stroke="url(#avi-arc)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray="283"
          strokeDashoffset="65"
        />
        {[...Array(11)].map((_, i) => {
          const angle = -Math.PI + (i * Math.PI) / 10
          const x1 = Math.cos(angle) * 74
          const y1 = Math.sin(angle) * 74
          const x2 = Math.cos(angle) * 64
          const y2 = Math.sin(angle) * 64
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={MUTED}
              strokeWidth="1.2"
              opacity="0.5"
            />
          )
        })}
        <text
          textAnchor="middle"
          y="-12"
          fontFamily="Lato, sans-serif"
          fontWeight="900"
          fontSize="44"
          fill={INK}
        >
          82
        </text>
        <text
          textAnchor="middle"
          y="10"
          fontFamily="Inter, sans-serif"
          fontWeight="600"
          fontSize="10"
          letterSpacing="0.06em"
          fill={MUTED}
        >
          AI VISIBILITY INDEX
        </text>
      </g>

      {/* mini chips — repositioned below the gauge with inverted INK background
          so the values are readable on both light and dark themes. */}
      {[
        { x: 50, label: 'CITATIONS', val: '+18%', accent: ACCENT },
        { x: 155, label: 'SENTIMENT', val: '+0.42', accent: SECOND },
        { x: 260, label: 'POSITION', val: '#2', accent: ACCENT },
      ].map((c) => (
        <g key={c.label} transform={`translate(${c.x}, 240)`}>
          <rect width="90" height="44" rx="10" fill={INK} />
          <text
            x="12"
            y="18"
            fontFamily="Inter, sans-serif"
            fontWeight="600"
            fontSize="9"
            letterSpacing="0.08em"
            fill="oklch(0.99 0 0 / 0.65)"
          >
            {c.label}
          </text>
          <text
            x="12"
            y="35"
            fontFamily="Lato, sans-serif"
            fontWeight="900"
            fontSize="14"
            fill={c.accent}
          >
            {c.val}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function MultiEngineIllustration({ className }: { className?: string }) {
  const engines = [
    { name: 'ChatGPT', x: 80, y: 80, color: ACCENT },
    { name: 'Gemini', x: 320, y: 80, color: SECOND },
    { name: 'Perplexity', x: 80, y: 220, color: SECOND },
    { name: 'Claude', x: 320, y: 220, color: ACCENT },
  ]
  return (
    <svg viewBox="0 0 400 320" className={cn('aio-illu', className)} aria-hidden="true">
      <defs>
        <radialGradient id="me-hub" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.7" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* connecting lines */}
      {engines.map((e, i) => (
        <line
          key={`line-${i}`}
          x1="200"
          y1="150"
          x2={e.x}
          y2={e.y}
          stroke={ACCENT}
          strokeOpacity="0.35"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="16"
            dur="1.2s"
            repeatCount="indefinite"
          />
        </line>
      ))}

      {/* central hub */}
      <circle cx="200" cy="150" r="60" fill="url(#me-hub)" />
      <circle cx="200" cy="150" r="34" fill={SURFACE} stroke={ACCENT} strokeWidth="2" />
      <path
        className="aio-illu__heart-beat"
        d="M180,150 L188,150 L193,138 L200,162 L207,132 L214,162 L222,150 L230,150"
        fill="none"
        stroke={ACCENT}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* engine nodes */}
      {engines.map((e, i) => (
        <g key={e.name} transform={`translate(${e.x}, ${e.y})`}>
          <circle r="34" fill={SURFACE} stroke={SURFACE_2} strokeWidth="1.5" />
          <circle
            r="34"
            fill="none"
            stroke={e.color}
            strokeWidth="2.5"
            strokeDasharray={`${10 + i * 8} 200`}
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0"
              to="360"
              dur={`${6 + i}s`}
              repeatCount="indefinite"
            />
          </circle>
          <text
            textAnchor="middle"
            y="-3"
            fontFamily="Lato, sans-serif"
            fontWeight="900"
            fontSize="11"
            fill={INK}
          >
            {e.name.slice(0, 3).toUpperCase()}
          </text>
          <text
            textAnchor="middle"
            y="10"
            fontFamily="Inter, sans-serif"
            fontWeight="600"
            fontSize="7"
            fill={MUTED}
          >
            ENGINE
          </text>
        </g>
      ))}
    </svg>
  )
}

export function CompetitiveIllustration({ className }: { className?: string }) {
  const bars = [
    { label: 'You', value: 0.82, color: ACCENT },
    { label: 'Comp A', value: 0.54, color: SECOND },
    { label: 'Comp B', value: 0.37, color: 'oklch(0.65 0.18 195)' },
    { label: 'Comp C', value: 0.22, color: 'oklch(0.7 0.15 280)' },
  ]
  return (
    <svg viewBox="0 0 400 280" className={cn('aio-illu', className)} aria-hidden="true">
      <rect
        x="30"
        y="20"
        width="340"
        height="240"
        rx="22"
        fill={SURFACE}
        stroke={SURFACE_2}
        strokeWidth="1.5"
      />
      <text x="50" y="50" fontFamily="Lato, sans-serif" fontWeight="900" fontSize="13" fill={INK}>
        SHARE OF VOICE
      </text>
      <text x="50" y="64" fontFamily="Inter, sans-serif" fontWeight="500" fontSize="9" fill={MUTED}>
        Citation rate per brand · last 30d
      </text>

      {bars.map((b, i) => {
        const y = 90 + i * 38
        const w = 240 * b.value
        return (
          <g key={b.label}>
            <text
              x="50"
              y={y - 6}
              fontFamily="Inter, sans-serif"
              fontWeight="700"
              fontSize="10"
              fill={INK}
            >
              {b.label}
            </text>
            <text
              x={50 + w + 10}
              y={y + 10}
              fontFamily="Lato, sans-serif"
              fontWeight="900"
              fontSize="11"
              fill={b.color}
            >
              {Math.round(b.value * 100)}%
            </text>
            <rect x="50" y={y} width="240" height="14" rx="7" fill={SURFACE_2} />
            <rect
              className="aio-illu__bar"
              x="50"
              y={y}
              width={w}
              height="14"
              rx="7"
              fill={b.color}
              style={{ transformOrigin: `50px ${y + 7}px` }}
            />
          </g>
        )
      })}
    </svg>
  )
}

export function ContentOptIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 280" className={cn('aio-illu', className)} aria-hidden="true">
      <defs>
        <linearGradient id="co-page" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={SURFACE} />
          <stop offset="100%" stopColor={SURFACE_2} />
        </linearGradient>
      </defs>
      <rect
        x="80"
        y="20"
        width="220"
        height="240"
        rx="14"
        fill="url(#co-page)"
        stroke={SURFACE_2}
        strokeWidth="1.5"
      />

      {/* doc lines */}
      <rect x="100" y="44" width="140" height="10" rx="3" fill={INK} opacity="0.9" />
      <rect x="100" y="62" width="180" height="6" rx="3" fill={MUTED} opacity="0.4" />
      <rect x="100" y="74" width="120" height="6" rx="3" fill={MUTED} opacity="0.4" />

      {/* highlighted snippet */}
      <rect
        x="100"
        y="98"
        width="180"
        height="36"
        rx="8"
        fill={ACCENT_SOFT}
        stroke={ACCENT}
        strokeWidth="1.5"
      />
      <rect x="108" y="106" width="100" height="6" rx="3" fill={ACCENT} />
      <rect x="108" y="118" width="140" height="6" rx="3" fill={ACCENT} opacity="0.65" />

      <rect x="100" y="148" width="120" height="6" rx="3" fill={MUTED} opacity="0.4" />
      <rect x="100" y="160" width="160" height="6" rx="3" fill={MUTED} opacity="0.4" />
      <rect x="100" y="172" width="80" height="6" rx="3" fill={MUTED} opacity="0.4" />

      {/* schema chip */}
      <rect x="100" y="200" width="100" height="24" rx="6" fill={INK} />
      <text
        x="112"
        y="216"
        fontFamily="Fragment Mono, monospace"
        fontWeight="400"
        fontSize="10"
        fill={SURFACE}
      >
        JSON-LD
      </text>

      {/* GEO badge floating */}
      <g transform="translate(298, 56)" className="aio-illu__float">
        <circle r="40" fill={ACCENT} />
        <text
          textAnchor="middle"
          y="-3"
          fontFamily="Lato, sans-serif"
          fontWeight="900"
          fontSize="20"
          fill="oklch(0.99 0 0)"
        >
          GEO
        </text>
        <text
          textAnchor="middle"
          y="14"
          fontFamily="Inter, sans-serif"
          fontWeight="700"
          fontSize="8"
          fill="oklch(0.99 0 0 / 0.85)"
        >
          SCORE 94
        </text>
      </g>

      {/* arrow */}
      <path
        d="M260,118 Q288,118 296,98"
        fill="none"
        stroke={ACCENT}
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />
    </svg>
  )
}

/* ─── CAPABILITY CARDS — 3 mid-size square illustrations ─────────────────── */

export function AeoSnippetCapability({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={cn('aio-illu', className)} aria-hidden="true">
      <rect
        x="20"
        y="40"
        width="160"
        height="120"
        rx="14"
        fill={SURFACE}
        stroke={SURFACE_2}
        strokeWidth="1.5"
      />
      <rect x="36" y="58" width="50" height="20" rx="6" fill={ACCENT} />
      <text
        x="61"
        y="72"
        textAnchor="middle"
        fontFamily="Lato, sans-serif"
        fontWeight="900"
        fontSize="12"
        fill="oklch(0.99 0 0)"
      >
        Q?
      </text>
      <rect x="36" y="92" width="128" height="8" rx="3" fill={INK} opacity="0.85" />
      <rect x="36" y="106" width="100" height="6" rx="3" fill={MUTED} opacity="0.5" />
      <rect x="36" y="118" width="118" height="6" rx="3" fill={MUTED} opacity="0.5" />
      <rect x="36" y="130" width="60" height="6" rx="3" fill={MUTED} opacity="0.5" />

      {/* schema chip */}
      <g transform="translate(116, 26)">
        <rect width="68" height="20" rx="6" fill={INK} />
        <text
          x="34"
          y="14"
          textAnchor="middle"
          fontFamily="Fragment Mono, monospace"
          fontWeight="400"
          fontSize="9"
          fill={SURFACE}
        >
          FAQPage
        </text>
      </g>

      {/* sparkle */}
      <g transform="translate(160, 150)">
        <path d="M0,-8 L2,-2 L8,0 L2,2 L0,8 L-2,2 L-8,0 L-2,-2 Z" fill={ACCENT}>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0"
            to="360"
            dur="8s"
            repeatCount="indefinite"
          />
        </path>
      </g>
    </svg>
  )
}

export function CitationCapability({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={cn('aio-illu', className)} aria-hidden="true">
      {/* stacked citation cards */}
      <g transform="translate(36, 56)">
        <rect width="128" height="80" rx="10" fill={SURFACE_2} transform="translate(12, 12)" />
        <rect
          width="128"
          height="80"
          rx="10"
          fill={SURFACE}
          stroke={SURFACE_2}
          strokeWidth="1.5"
          transform="translate(6, 6)"
        />
        <rect width="128" height="80" rx="10" fill={SURFACE} stroke={ACCENT} strokeWidth="1.8" />

        {/* quote mark */}
        <text
          x="14"
          y="34"
          fontFamily="Lato, sans-serif"
          fontWeight="900"
          fontSize="36"
          fill={ACCENT}
        >
          “
        </text>
        <rect x="36" y="22" width="78" height="6" rx="3" fill={INK} opacity="0.85" />
        <rect x="36" y="34" width="60" height="5" rx="2" fill={MUTED} opacity="0.5" />
        <rect x="14" y="52" width="100" height="5" rx="2" fill={MUTED} opacity="0.4" />
        <rect x="14" y="62" width="70" height="5" rx="2" fill={MUTED} opacity="0.4" />
      </g>

      {/* score pill */}
      <g transform="translate(120, 152)" className="aio-illu__float">
        <rect width="60" height="22" rx="11" fill={ACCENT} />
        <text
          x="30"
          y="15"
          textAnchor="middle"
          fontFamily="Lato, sans-serif"
          fontWeight="900"
          fontSize="11"
          fill="oklch(0.99 0 0)"
        >
          5/5 ★
        </text>
      </g>

      {/* freshness dot */}
      <circle cx="36" cy="160" r="6" fill={ACCENT}>
        <animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite" />
      </circle>
      <text
        x="48"
        y="164"
        fontFamily="Inter, sans-serif"
        fontWeight="700"
        fontSize="9"
        fill={MUTED}
      >
        FRESH · 2h
      </text>
    </svg>
  )
}

export function BrandHealthCapability({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={cn('aio-illu', className)} aria-hidden="true">
      <defs>
        <linearGradient id="bh-wave" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0" />
          <stop offset="50%" stopColor={ACCENT} stopOpacity="1" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect
        x="20"
        y="50"
        width="160"
        height="110"
        rx="14"
        fill={SURFACE}
        stroke={SURFACE_2}
        strokeWidth="1.5"
      />

      {/* heart */}
      <g transform="translate(50, 92)">
        <path
          d="M0,-2 C-5,-12 -18,-12 -18,2 C-18,12 0,22 0,22 C0,22 18,12 18,2 C18,-12 5,-12 0,-2 Z"
          fill={ACCENT}
        >
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1;1.12;1;1.06;1"
            keyTimes="0;0.15;0.3;0.45;1"
            dur="1.2s"
            repeatCount="indefinite"
            additive="sum"
          />
        </path>
      </g>

      {/* pulse line */}
      <path
        d="M76,98 L96,98 L102,80 L112,118 L122,68 L132,118 L142,90 L160,90"
        fill="none"
        stroke="url(#bh-wave)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* sentiment chips */}
      <g transform="translate(36, 130)">
        <rect width="36" height="18" rx="9" fill="oklch(0.72 0.19 150 / 0.18)" />
        <text
          x="18"
          y="12"
          textAnchor="middle"
          fontFamily="Lato, sans-serif"
          fontWeight="900"
          fontSize="9"
          fill="oklch(0.5 0.18 150)"
        >
          POS 72
        </text>
        <rect x="44" width="36" height="18" rx="9" fill={ACCENT_SOFT} />
        <text
          x="62"
          y="12"
          textAnchor="middle"
          fontFamily="Lato, sans-serif"
          fontWeight="900"
          fontSize="9"
          fill={ACCENT}
        >
          NEU 22
        </text>
        <rect x="88" width="36" height="18" rx="9" fill="oklch(0.6 0.18 25 / 0.18)" />
        <text
          x="106"
          y="12"
          textAnchor="middle"
          fontFamily="Lato, sans-serif"
          fontWeight="900"
          fontSize="9"
          fill="oklch(0.5 0.18 25)"
        >
          NEG 6
        </text>
      </g>

      {/* alert bell */}
      <g transform="translate(160, 36)">
        <circle r="14" fill={ACCENT} />
        <path
          d="M-5,-3 C-5,-7 -2,-9 0,-9 C2,-9 5,-7 5,-3 L5,1 L7,3 L-7,3 L-5,1 Z M-2,4 C-2,6 -1,7 0,7 C1,7 2,6 2,4 Z"
          fill="oklch(0.99 0 0)"
        />
      </g>
    </svg>
  )
}

/* ─── INDUSTRY ICONS — 10 small geometric icons ──────────────────────────── */

type IndustryProps = { className?: string }

function IndustryFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('aio-illu', className)} aria-hidden="true">
      <rect x="6" y="6" width="52" height="52" rx="14" fill={ACCENT_SOFT} />
      {children}
    </svg>
  )
}

export function TravelIcon(p: IndustryProps) {
  return (
    <IndustryFrame className={p.className}>
      {/* paper plane */}
      <path d="M16,38 L48,18 L40,46 L32,38 L24,46 Z" fill={ACCENT} />
      <path d="M32,38 L40,28" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="46" cy="46" r="2.5" fill={SECOND} />
      <circle cx="20" cy="20" r="2" fill={SECOND} opacity="0.6" />
    </IndustryFrame>
  )
}

export function EcommerceIcon(p: IndustryProps) {
  return (
    <IndustryFrame className={p.className}>
      <path
        d="M18,22 L46,22 L42,42 L22,42 Z"
        fill={SURFACE}
        stroke={ACCENT}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M26,22 C26,18 28,16 32,16 C36,16 38,18 38,22"
        fill="none"
        stroke={INK}
        strokeWidth="2"
      />
      <circle cx="26" cy="48" r="3" fill={ACCENT} />
      <circle cx="40" cy="48" r="3" fill={ACCENT} />
    </IndustryFrame>
  )
}

export function FinanceIcon(p: IndustryProps) {
  return (
    <IndustryFrame className={p.className}>
      <rect x="14" y="38" width="8" height="14" rx="2" fill={INK} opacity="0.85" />
      <rect x="26" y="30" width="8" height="22" rx="2" fill={ACCENT} />
      <rect x="38" y="22" width="8" height="30" rx="2" fill={SECOND} />
      <path
        d="M14,36 L26,30 L38,24 L48,18"
        stroke={ACCENT}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="48" cy="18" r="2.5" fill={ACCENT} />
    </IndustryFrame>
  )
}

export function HealthcareIcon(p: IndustryProps) {
  return (
    <IndustryFrame className={p.className}>
      <path
        d="M32,18 C26,18 22,22 22,30 C22,38 32,48 32,48 C32,48 42,38 42,30 C42,22 38,18 32,18 Z"
        fill={ACCENT}
      />
      <rect x="30" y="26" width="4" height="14" rx="1" fill={SURFACE} />
      <rect x="25" y="31" width="14" height="4" rx="1" fill={SURFACE} />
    </IndustryFrame>
  )
}

export function AutomotiveIcon(p: IndustryProps) {
  return (
    <IndustryFrame className={p.className}>
      <path
        d="M14,38 L18,28 C20,24 24,22 28,22 L38,22 C42,22 46,24 48,28 L50,38 L50,44 L14,44 Z"
        fill={ACCENT}
      />
      <rect x="22" y="28" width="20" height="6" rx="2" fill={SURFACE} opacity="0.85" />
      <circle cx="22" cy="46" r="4" fill={INK} />
      <circle cx="42" cy="46" r="4" fill={INK} />
    </IndustryFrame>
  )
}

export function EducationIcon(p: IndustryProps) {
  return (
    <IndustryFrame className={p.className}>
      <path d="M14,28 L32,18 L50,28 L32,38 Z" fill={ACCENT} />
      <path
        d="M20,32 L20,42 C20,46 26,48 32,48 C38,48 44,46 44,42 L44,32"
        fill="none"
        stroke={INK}
        strokeWidth="2"
      />
      <line x1="48" y1="28" x2="48" y2="40" stroke={SECOND} strokeWidth="2" strokeLinecap="round" />
    </IndustryFrame>
  )
}

export function RealEstateIcon(p: IndustryProps) {
  return (
    <IndustryFrame className={p.className}>
      <path d="M14,32 L32,18 L50,32 L50,48 L14,48 Z" fill={ACCENT} />
      <rect x="28" y="36" width="8" height="12" fill={SURFACE} />
      <circle cx="32" cy="42" r="0.8" fill={INK} />
    </IndustryFrame>
  )
}

export function LegalIcon(p: IndustryProps) {
  return (
    <IndustryFrame className={p.className}>
      <line x1="32" y1="16" x2="32" y2="48" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="20" x2="44" y2="20" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      {/* left pan */}
      <path d="M14,28 L26,28 L23,38 Z" fill={ACCENT} />
      <line x1="20" y1="20" x2="20" y2="28" stroke={INK} strokeWidth="1.5" />
      {/* right pan */}
      <path d="M38,28 L50,28 L47,38 Z" fill={SECOND} />
      <line x1="44" y1="20" x2="44" y2="28" stroke={INK} strokeWidth="1.5" />
      <rect x="28" y="48" width="8" height="3" rx="1" fill={INK} />
    </IndustryFrame>
  )
}

export function SaasIcon(p: IndustryProps) {
  return (
    <IndustryFrame className={p.className}>
      <rect x="16" y="20" width="32" height="22" rx="3" fill={ACCENT} />
      <rect x="20" y="24" width="24" height="2" rx="1" fill={SURFACE} />
      <circle cx="22" cy="24" r="0.8" fill={SECOND} />
      <rect x="22" y="30" width="8" height="2" rx="1" fill={SURFACE} opacity="0.85" />
      <rect x="22" y="34" width="16" height="2" rx="1" fill={SURFACE} opacity="0.65" />
      <rect x="22" y="38" width="12" height="2" rx="1" fill={SURFACE} opacity="0.65" />
      <rect x="14" y="46" width="36" height="4" rx="2" fill={INK} />
    </IndustryFrame>
  )
}

export function CryptoIcon(p: IndustryProps) {
  return (
    <IndustryFrame className={p.className}>
      <polygon points="32,14 50,24 50,40 32,50 14,40 14,24" fill={ACCENT} />
      <polygon points="32,14 50,24 32,34 14,24" fill={SECOND} opacity="0.55" />
      <text
        x="32"
        y="36"
        textAnchor="middle"
        fontFamily="Lato, sans-serif"
        fontWeight="900"
        fontSize="14"
        fill={SURFACE}
      >
        ₿
      </text>
    </IndustryFrame>
  )
}
