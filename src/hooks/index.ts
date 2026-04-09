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
  const toggle   = useCallback(() => setValue((v) => !v), [])
  const setTrue  = useCallback(() => setValue(true), [])
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

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return { copied, copy, reset }
}

// ─── useDebounce ──────────────────────────────────────────────────────────────

export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

// ─── useAsyncFetch ────────────────────────────────────────────────────────────

type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

interface UseAsyncFetchState<T> {
  data: T | null
  status: FetchStatus
  error: string | null
}

interface UseAsyncFetchReturn<T> extends UseAsyncFetchState<T> {
  loading: boolean
  execute: (...args: unknown[]) => Promise<T | null>
  reset: () => void
}

export function useAsyncFetch<T>(
  fetcher: (...args: unknown[]) => Promise<T>,
): UseAsyncFetchReturn<T> {
  const [state, setState] = useState<UseAsyncFetchState<T>>({
    data: null,
    status: 'idle',
    error: null,
  })

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      setState({ data: null, status: 'loading', error: null })
      try {
        const result = await fetcher(...args)
        setState({ data: result, status: 'success', error: null })
        return result
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred'
        setState((prev) => ({ ...prev, status: 'error', error: message }))
        return null
      }
    },
    [fetcher],
  )

  const reset = useCallback(() => {
    setState({ data: null, status: 'idle', error: null })
  }, [])

  return {
    ...state,
    loading: state.status === 'loading',
    execute,
    reset,
  }
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
      { subject: 'Density',     A: seoScore.density,   fullMark: 100 },
      { subject: 'Impact',      A: seoScore.strategy,  fullMark: 100 },
      { subject: 'Market Ease', A: seoScore.difficulty, fullMark: 100 },
      { subject: 'Visibility',  A: seoScore.visibility, fullMark: 100 },
      { subject: 'Semantic',    A: 85,                 fullMark: 100 },
    ],
    [seoScore],
  )

  const avgDifficulty = useMemo<number>(() => {
    if (keywords.length === 0) return 0
    return Math.round(keywords.reduce((acc, kw) => acc + kw.difficulty, 0) / keywords.length)
  }, [keywords])

  return { keywordDensity, seoScore, radarData, avgDifficulty }
}

// ─── useLocalStorage ─────────────────────────────────────────────────────────

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [stored, setStored] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue
    try {
      const item = window.localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStored((prev) => {
        const next = value instanceof Function ? value(prev) : value
        try {
          window.localStorage.setItem(key, JSON.stringify(next))
        } catch {
          console.error(`[useLocalStorage] Failed to set "${key}"`)
        }
        return next
      })
    },
    [key],
  )

  return [stored, setValue]
}

// ─── useMediaQuery ─────────────────────────────────────────────────────────────

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(query)
    setMatches(mq.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])

  return matches
}

// ─── usePrevious ──────────────────────────────────────────────────────────────

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined)
  useEffect(() => { ref.current = value }, [value])
  return ref.current
}

// ─── useOutsideClick ──────────────────────────────────────────────────────────

export function useOutsideClick(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
): void {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return
      handler()
    }
    document.addEventListener('mousedown', listener)
    document.addEventListener('touchstart', listener)
    return () => {
      document.removeEventListener('mousedown', listener)
      document.removeEventListener('touchstart', listener)
    }
  }, [ref, handler])
}
