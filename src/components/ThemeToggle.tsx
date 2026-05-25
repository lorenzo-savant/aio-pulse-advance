'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useMounted } from '@/lib/hooks/use-mounted'

export function ThemeToggle() {
  const mounted = useMounted()
  const { theme, setTheme } = useTheme()

  if (!mounted) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-lg">
        <div className="h-5 w-5" />
      </div>
    )
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="hover:border-border-hover bg-surface-input text-text-on-surface hover:bg-surface-row-hover flex h-9 w-9 items-center justify-center rounded-lg border border-border transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
