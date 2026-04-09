'use client'

import { useTheme } from 'next-themes'

export function useChartTheme() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return {
    tooltipStyle: {
      contentStyle: {
        background: isDark ? '#0f172a' : '#ffffff',
        border: `1px solid ${isDark ? '#1f2937' : '#e2e8f0'}`,
        borderRadius: 8,
        fontSize: 12,
        color: isDark ? '#e2e8f0' : '#0f172a',
      },
      labelStyle: {
        color: isDark ? '#e2e8f0' : '#0f172a',
        fontWeight: 700,
      },
    },
    gridColor: isDark ? '#1f2937' : '#e2e8f0',
    axisColor: isDark ? '#6b7280' : '#9ca3af',
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
  }
}
