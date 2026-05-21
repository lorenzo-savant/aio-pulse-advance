'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, Check, Loader2, Database } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  PROMPT_TEMPLATES,
  PROMPT_CATEGORIES,
  hydratePrompt,
  type PromptCategory,
  type PromptLang,
} from '@/lib/prompt-library'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface Props {
  brandId: string
  brandName: string
  industry?: string
  competitors?: string[]
  language?: PromptLang
  onComplete?: (stats: { created: number; skipped: number }) => void
}

export function PromptLibrarySelector({
  brandId,
  brandName,
  industry,
  competitors = [],
  language = 'en',
  onComplete,
}: Props) {
  const [selectedCategories, setSelectedCategories] = useState<Set<PromptCategory>>(
    new Set(Object.keys(PROMPT_CATEGORIES) as PromptCategory[]),
  )
  const [openCategory, setOpenCategory] = useState<PromptCategory | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null)

  const hydrationParams = {
    brand: brandName,
    category: industry || 'your industry',
    competitor: competitors[0] || 'competitor',
    competitor2: competitors[1] || 'another competitor',
    location: language === 'sv' ? 'Sweden' : language === 'it' ? 'Italy' : 'your market',
    use_case: industry ? `${industry} solutions` : 'business solutions',
  }

  const templatesByCategory = useMemo(() => {
    const grouped: Record<PromptCategory, typeof PROMPT_TEMPLATES> = {} as Record<
      PromptCategory,
      typeof PROMPT_TEMPLATES
    >
    for (const t of PROMPT_TEMPLATES) {
      if (!grouped[t.category]) {
        grouped[t.category] = []
      }
      grouped[t.category].push(t)
    }
    return grouped
  }, [])

  const selectedPromptsCount = useMemo(() => {
    let count = 0
    for (const cat of Object.keys(templatesByCategory) as PromptCategory[]) {
      if (selectedCategories.has(cat)) {
        count += templatesByCategory[cat].length
      }
    }
    return count
  }, [selectedCategories, templatesByCategory])

  const toggleCategory = (cat: PromptCategory) => {
    const newSet = new Set(selectedCategories)
    if (newSet.has(cat)) {
      newSet.delete(cat)
    } else {
      newSet.add(cat)
    }
    setSelectedCategories(newSet)
  }

  const selectAll = () => {
    setSelectedCategories(new Set(Object.keys(PROMPT_CATEGORIES) as PromptCategory[]))
  }

  const selectNone = () => {
    setSelectedCategories(new Set())
  }

  const handleSeed = async () => {
    if (selectedCategories.size === 0) {
      toast.error('Select at least one category')
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/prompts/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          categories: Array.from(selectedCategories),
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Seed failed')
      }

      const stats = {
        created: json.stats.created,
        skipped: json.stats.skippedDuplicates,
      }
      setResult(stats)
      toast.success(`Created ${stats.created} prompts, ${stats.skipped} skipped`)
      onComplete?.(stats)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Seed failed')
    } finally {
      setLoading(false)
    }
  }

  const categories = Object.keys(PROMPT_CATEGORIES) as PromptCategory[]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="text-brand-400 h-5 w-5" />
          <span className="font-bold text-foreground">Prompt Library</span>
        </div>
        <div className="flex gap-2">
          <button
            className="text-xs text-muted-foreground underline hover:text-brand"
            onClick={selectAll}
          >
            Select All
          </button>
          <span className="text-xs text-muted-foreground">|</span>
          <button
            className="text-xs text-muted-foreground underline hover:text-brand"
            onClick={selectNone}
          >
            Select None
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {categories.map((cat) => {
          const info = PROMPT_CATEGORIES[cat]
          const templates = templatesByCategory[cat]
          const isSelected = selectedCategories.has(cat)
          const isOpen = openCategory === cat

          return (
            <Card key={cat} className="overflow-hidden">
              <button
                className={cn(
                  'flex w-full items-center justify-between px-4 py-3 text-left transition-colors',
                  'hover:bg-secondary/50',
                )}
                onClick={() => setOpenCategory(isOpen ? null : cat)}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation()
                      toggleCategory(cat)
                    }}
                    className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                  />
                  <div>
                    <span className="font-medium text-foreground">{info.label}</span>
                    <p className="text-xs text-muted-foreground">{info.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default" size="sm">
                    {templates.length} prompts
                  </Badge>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform',
                      isOpen && 'rotate-180',
                    )}
                  />
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border px-4 py-3">
                  <div className="space-y-2">
                    {templates.map((t) => (
                      <div key={t.id} className="bg-secondary/30 rounded-lg p-2.5 text-xs">
                        <Badge variant="outline" size="sm" className="mb-1.5">
                          {t.id}
                        </Badge>
                        <p className="text-muted-foreground">
                          {hydratePrompt(t, language, hydrationParams)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <div className="sticky bottom-0 z-10 flex items-center justify-between rounded-xl border border-border bg-secondary px-4 py-3 shadow-lg">
        <span className="text-sm text-muted-foreground">
          {selectedCategories.size} categor
          {selectedCategories.size !== 1 ? 'ies' : ''} selected ({selectedPromptsCount} prompts)
        </span>
        <div className="flex items-center gap-3">
          {result && (
            <span className="text-sm text-emerald-400">
              Created {result.created}, {result.skipped} skipped
            </span>
          )}
          <Button
            size="sm"
            onClick={handleSeed}
            disabled={loading || selectedCategories.size === 0}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Seed {selectedPromptsCount} Prompt{selectedPromptsCount !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}
