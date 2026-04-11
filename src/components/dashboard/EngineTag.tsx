'use client'

import { cn } from '@/lib/utils'

const ENGINE_STYLES: Record<string, string> = {
  chatgpt: 'bg-success-muted text-success',
  gemini: 'bg-warning-muted text-warning',
  perplexity: 'bg-brand-muted text-brand',
  claude: 'bg-purple-500/15 text-purple-400',
  all: 'bg-secondary text-muted-foreground',
}

interface EngineTagProps {
  engine: string
  className?: string
}

export function EngineTag({ engine, className }: EngineTagProps) {
  return (
    <span
      className={cn(
        'rounded-md px-2 py-0.5 text-[9px] font-bold uppercase',
        ENGINE_STYLES[engine] || 'bg-secondary text-muted-foreground',
        className,
      )}
    >
      {engine}
    </span>
  )
}
