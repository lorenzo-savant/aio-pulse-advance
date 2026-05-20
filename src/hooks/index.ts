'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import type { Keyword, KeywordWithDensity } from '@/types'

// ─── useToggle ────────────────────────────────────────────────────────────────

interface UseToggleReturn {
  value: boolean
  toggle: () => void
  setTrue: () => void
  setFalse: () => void
  set: (val: boolean) => void
}

export function useToggle(initial = false): UseToggleReturn {
  const [value, setValue] = useState(initial)
  const toggle = useCallback(() => setValue((v) => !v), [])
  const setTrue = useCallback(() => setValue(true), [])
  const setFalse = useCallback(() => setValue(false), [])
  return { value, toggle, setTrue, setFalse, set: setValue }
}

// ─── useClipboard ─────────────────────────────────────────────────────────────

interface UseClipboardReturn {
  copied: boolean
  copy: (text: string) => Promise<void>
  reset: () => void
}

export function useClipboard(resetMs = 2000): UseClipboardReturn {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => setCopied(false), resetMs)
      } catch {
        console.error('[useClipboard] Failed to copy')
      }
    },
    [resetMs],
  )

  const reset = useCallback(() => {
    setCopied(false)
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  return { copied, copy, reset }
}

// ─── useKeywordAnalysis ───────────────────────────────────────────────────────

interface SeoScoreDetails {
  total: number
  density: number
  strategy: number
  difficulty: number
  visibility: number
}

interface RadarPoint {
  subject: string
  A: number
  fullMark: number
}

interface UseKeywordAnalysisReturn {
  keywordDensity: KeywordWithDensity[]
  seoScore: SeoScoreDetails
  radarData: RadarPoint[]
  avgDifficulty: number
}

export function useKeywordAnalysis(
  keywords: Keyword[],
  analyzedText: string | undefined,
  visibilityScore: number,
): UseKeywordAnalysisReturn {
  const keywordDensity = useMemo<KeywordWithDensity[]>(() => {
    if (!analyzedText || keywords.length === 0) return []
    const text = analyzedText.toLowerCase()
    const words = text.match(/\b[\w'-]+\b/g) ?? []
    const totalWords = words.length
    if (totalWords === 0) return []

    return keywords
      .map((kw) => {
        const regex = new RegExp(
          `\\b${kw.word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
          'gi',
        )
        const count = (text.match(regex) ?? []).length
        const density = (count / totalWords) * 100
        return { ...kw, count, density }
      })
      .sort((a, b) => b.density - a.density)
  }, [keywords, analyzedText])

  const seoScore = useMemo<SeoScoreDetails>(() => {
    if (keywordDensity.length === 0)
      return { total: 0, density: 0, strategy: 0, difficulty: 0, visibility: 0 }

    const densityScores = keywordDensity.map((kw) => {
      const diff = Math.abs(kw.density - 2.5)
      return Math.max(0, 100 - diff * diff * 15)
    })
    const avgDensity = densityScores.reduce((a, b) => a + b, 0) / densityScores.length
    const avgImpact = keywordDensity.reduce((a, b) => a + b.impact, 0) / keywordDensity.length
    const difficultyHealth =
      keywordDensity.reduce((a, b) => a + (100 - b.difficulty), 0) / keywordDensity.length
    const total = Math.round(
      avgDensity * 0.3 + avgImpact * 0.35 + difficultyHealth * 0.2 + visibilityScore * 0.15,
    )

    return {
      total,
      density: Math.round(avgDensity),
      strategy: Math.round(avgImpact),
      difficulty: Math.round(difficultyHealth),
      visibility: Math.round(visibilityScore),
    }
  }, [keywordDensity, visibilityScore])

  const radarData = useMemo<RadarPoint[]>(
    () => [
      { subject: 'Density', A: seoScore.density, fullMark: 100 },
      { subject: 'Impact', A: seoScore.strategy, fullMark: 100 },
      { subject: 'Market Ease', A: seoScore.difficulty, fullMark: 100 },
      { subject: 'Visibility', A: seoScore.visibility, fullMark: 100 },
      { subject: 'Semantic', A: 85, fullMark: 100 },
    ],
    [seoScore],
  )

  const avgDifficulty = useMemo<number>(() => {
    if (keywords.length === 0) return 0
    return Math.round(keywords.reduce((acc, kw) => acc + kw.difficulty, 0) / keywords.length)
  }, [keywords])

  return { keywordDensity, seoScore, radarData, avgDifficulty }
}
