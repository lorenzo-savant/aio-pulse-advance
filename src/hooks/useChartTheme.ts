'use client'

// Backwards-compat wrapper around src/lib/chart-tokens.ts.
//
// The existing dashboards (geo-score, citations, snapshots, etc.) all
// call `useChartTheme()` and read .tooltipStyle / .gridColor / .axisColor
// off the return value. This hook delegates to useChartAxisTokens() and
// shapes the response into the legacy interface — old call sites keep
// working, but the colours they get are now coherent with the design
// system (surface-300 grid on light, navy-700 on dark, etc.) instead of
// the previous ad-hoc near-blacks (#0f172a, #1f2937) that were nearly
// invisible on the F4F7FE light background.
//
// New code should import directly from '@/lib/chart-tokens' for
// engineColor / scoreColor / categoricalColor.

import { useChartAxisTokens } from '@/lib/chart-tokens'

export function useChartTheme() {
  const tokens = useChartAxisTokens()
  return {
    tooltipStyle: {
      contentStyle: {
        background: tokens.tooltipBg,
        border: `1px solid ${tokens.tooltipBorder}`,
        borderRadius: 8,
        fontSize: 12,
        color: tokens.tooltipText,
      },
      labelStyle: {
        color: tokens.tooltipText,
        fontWeight: 700,
      },
    },
    gridColor: tokens.grid,
    axisColor: tokens.tick,
    backgroundColor: tokens.tooltipBg,
  }
}
