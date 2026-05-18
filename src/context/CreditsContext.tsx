'use client'

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import type { UserCredits } from '@/lib/credits'
import { DEFAULT_CREDITS, calculateCreditsAvailable } from '@/lib/credits'

interface CreditsContextValue {
  credits: UserCredits | null
  isLoading: boolean
  error: string | null
  refreshCredits: () => Promise<void>
  deduct: (amount: number, description: string) => Promise<boolean>
  add: (amount: number, description: string) => Promise<void>
  hasCredits: (amount: number) => boolean
}

const CreditsContext = createContext<CreditsContextValue | null>(null)

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const [credits, setCredits] = useState<UserCredits | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshCredits = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/credits')
      if (!res.ok) throw new Error('Failed to fetch credits')
      const data = await res.json()
      setCredits(data.credits)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setCredits(
        (prev) =>
          prev ?? {
            userId: 'local',
            totalCredits: DEFAULT_CREDITS,
            usedCredits: 0,
            availableCredits: DEFAULT_CREDITS,
            lastUpdated: new Date().toISOString(),
          },
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshCredits()
  }, [refreshCredits])

  const deduct = useCallback(
    async (amount: number, description: string): Promise<boolean> => {
      if (!credits) return false
      if (credits.availableCredits < amount) return false

      try {
        const res = await fetch('/api/credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'deduct', amount, description }),
        })
        if (!res.ok) throw new Error('Failed to deduct credits')
        const data = await res.json()
        setCredits(data.credits)
        // Credits stored server-side only — no localStorage (XSS risk)
        return true
      } catch (err) {
        const newCredits: UserCredits = {
          ...credits,
          usedCredits: credits.usedCredits + amount,
          availableCredits: credits.availableCredits - amount,
          lastUpdated: new Date().toISOString(),
        }
        setCredits(newCredits)
        // Credits stored server-side only — no localStorage (XSS risk)
        return true
      }
    },
    [credits],
  )

  const add = useCallback(
    async (amount: number, description: string) => {
      try {
        const res = await fetch('/api/credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add', amount, description }),
        })
        if (!res.ok) throw new Error('Failed to add credits')
        const data = await res.json()
        setCredits(data.credits)
        // Credits stored server-side only — no localStorage (XSS risk)
      } catch (err) {
        if (credits) {
          const newCredits: UserCredits = {
            ...credits,
            totalCredits: credits.totalCredits + amount,
            availableCredits: credits.availableCredits + amount,
            lastUpdated: new Date().toISOString(),
          }
          setCredits(newCredits)
          // Credits stored server-side only — no localStorage (XSS risk)
        }
      }
    },
    [credits],
  )

  const hasCredits = useCallback(
    (amount: number): boolean => {
      return credits ? credits.availableCredits >= amount : false
    },
    [credits],
  )

  const value = useMemo(
    () => ({
      credits,
      isLoading,
      error,
      refreshCredits,
      deduct,
      add,
      hasCredits,
    }),
    [credits, isLoading, error, refreshCredits, deduct, add, hasCredits],
  )

  return <CreditsContext.Provider value={value}>{children}</CreditsContext.Provider>
}

export function useCredits(): CreditsContextValue {
  const context = useContext(CreditsContext)
  if (!context) {
    throw new Error('useCredits must be used within a CreditsProvider')
  }
  return context
}

export function useAvailableCredits(): number {
  const { credits } = useCredits()
  return credits?.availableCredits ?? 0
}

export function useHasCredits(amount: number): boolean {
  const { hasCredits } = useCredits()
  return hasCredits(amount)
}
