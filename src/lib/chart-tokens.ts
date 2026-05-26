// PATH: src/lib/chart-tokens.ts
//
// Single source of truth for chart colors across the dashboard.
//
// Why this file exists: prior to consolidation, hex literals were
// scattered across ~12 dashboard pages and three different files
// disagreed on which colour represented Gemini vs Perplexity vs
// Claude. This file fixes the engine → colour mapping ONCE, and
// every chart imports from here. New engines → add a key here, not
// in the consumer.
//
// Recharts limitation: SVG stroke/fill props don't accept CSS
// variables natively. So engine + score colours stay hex literals,
// but they're declared in ONE place. Axis/grid colours that need
// theme-aware values use the `useChartAxisTokens()` hook which reads
// the resolved CSS variable at runtime.

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

/* ─── Engine palette ─────────────────────────────────────────────────────
   Picked so adjacent engines in any chart sit well together:
   - ChatGPT: emerald (the de-facto OpenAI brand colour in dashboards)
   - Gemini:  sky    (matches Google blue palette family)
   - Perplexity: violet (mirrors Perplexity's UI accent)
   - Claude:  amber  (matches Anthropic's warm-orange brand)
   These should NOT be reordered without a UX review — operators
   memorise colours across pages. */
export const ENGINE_COLORS = {
  chatgpt: '#10b981', // emerald-500
  gemini: '#3b82f6', // blue-500
  perplexity: '#a855f7', // purple-500
  claude: '#f97316', // orange-500
  unknown: '#6b7280', // gray-500 — fallback for engine == null
} as const

export type EngineKey = keyof typeof ENGINE_COLORS

/** Lookup with fallback. Pass any string; unknown engines return gray. */
export function engineColor(engine: string | null | undefined): string {
  if (!engine) return ENGINE_COLORS.unknown
  const key = engine.toLowerCase() as EngineKey
  return ENGINE_COLORS[key] ?? ENGINE_COLORS.unknown
}

/* ─── Score band palette ────────────────────────────────────────────────
   Used by GEO score, AI SEO readiness, citation worthiness — anywhere a
   0-100 grade is rendered. Bands matched 1:1 with the worthiness band
   labels (excellent / strong / moderate / weak / poor) so a A grade
   and a 90-point worthiness score render the same green. */
export const SCORE_BAND_COLORS = {
  excellent: '#10b981', // emerald
  strong: '#22c55e', // green
  moderate: '#f59e0b', // amber
  weak: '#f97316', // orange
  poor: '#ef4444', // red
} as const

export type ScoreBand = keyof typeof SCORE_BAND_COLORS

/** Numeric score (0-100) → band → colour. Tweak thresholds here once
 *  if the grading rubric changes; every chart inherits the change. */
export function scoreColor(score: number): string {
  if (score >= 80) return SCORE_BAND_COLORS.excellent
  if (score >= 65) return SCORE_BAND_COLORS.strong
  if (score >= 45) return SCORE_BAND_COLORS.moderate
  if (score >= 25) return SCORE_BAND_COLORS.weak
  return SCORE_BAND_COLORS.poor
}

/** Grade label A-F → colour, mirroring the readiness rubric. */
export const GRADE_COLORS = {
  A: SCORE_BAND_COLORS.excellent,
  B: SCORE_BAND_COLORS.strong,
  C: SCORE_BAND_COLORS.moderate,
  D: SCORE_BAND_COLORS.weak,
  F: SCORE_BAND_COLORS.poor,
} as const

/* ─── Categorical fallback palette ──────────────────────────────────────
   When charts need N distinct colours for arbitrary categories (e.g.
   competitor brands in a multi-series line chart), pull from this rotating
   palette. Order chosen for max perceptual distance between adjacent
   indexes. */
export const CATEGORICAL_PALETTE = [
  '#6366f1', // indigo  — brand primary
  '#10b981', // emerald
  '#f97316', // orange
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f59e0b', // amber
  '#3b82f6', // blue
] as const

export function categoricalColor(index: number): string {
  return CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length]!
}

/* ─── Theme-aware axis / grid tokens for Recharts ───────────────────────
   The old code hardcoded `stroke="#1f2937"` and `fill: '#6b7280'` for
   grids and axis labels. Those values look fine on dark navy but are
   nearly invisible on the light F4F7FE page background. This hook
   returns values matched to the current theme.

   Returns plain hex strings (not CSS vars) because Recharts SVG props
   require static values. Re-renders on theme change. */
export interface ChartAxisTokens {
  /** Grid line colour (CartesianGrid stroke). */
  grid: string
  /** Axis tick label colour (XAxis / YAxis tick fill). */
  tick: string
  /** Axis line colour (XAxis / YAxis stroke). */
  axisLine: string
  /** Tooltip background. */
  tooltipBg: string
  /** Tooltip border. */
  tooltipBorder: string
  /** Tooltip text. */
  tooltipText: string
}

const LIGHT_AXIS_TOKENS: ChartAxisTokens = {
  grid: '#E2E8F0', // surface-300 — soft gray on white
  tick: '#707EAE', // surface-700 — readable label
  axisLine: '#CBD5E1', // slate-300
  tooltipBg: '#FFFFFF',
  tooltipBorder: '#E2E8F0',
  tooltipText: '#2B3674', // surface-800
}

const DARK_AXIS_TOKENS: ChartAxisTokens = {
  grid: '#1B254B', // navy-700
  tick: '#A3AED0', // surface-500
  axisLine: '#1B254B',
  tooltipBg: '#111c44', // navy-800
  tooltipBorder: '#1B254B',
  tooltipText: '#FFFFFF',
}

/**
 * Hook that returns theme-aware Recharts axis/grid/tooltip colours.
 * Re-renders when the user toggles the theme. Returns SSR-safe defaults
 * during the brief mounting window (uses light values; theme flicker
 * is one paint).
 */
export function useChartAxisTokens(): ChartAxisTokens {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return LIGHT_AXIS_TOKENS
  return resolvedTheme === 'dark' ? DARK_AXIS_TOKENS : LIGHT_AXIS_TOKENS
}
