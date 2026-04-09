'use client'

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import type { QueryCategory, QueryCategoryInfo } from '@/types'
import { QUERY_CATEGORIES } from '@/types'

interface QueryCategoryContextValue {
  categories: QueryCategoryInfo[]
  selectedCategory: QueryCategory | null
  setSelectedCategory: (category: QueryCategory | null) => void
  isCategorySelected: (category: QueryCategory) => boolean
}

const QueryCategoryContext = createContext<QueryCategoryContextValue | null>(null)

export function QueryCategoryProvider({ children }: { children: React.ReactNode }) {
  const [selectedCategory, setSelectedCategoryState] = useState<QueryCategory | null>(null)

  const setSelectedCategory = useCallback((category: QueryCategory | null) => {
    setSelectedCategoryState(category)
  }, [])

  const isCategorySelected = useCallback(
    (category: QueryCategory) => {
      return selectedCategory === category
    },
    [selectedCategory],
  )

  const value = useMemo(
    () => ({
      categories: QUERY_CATEGORIES,
      selectedCategory,
      setSelectedCategory,
      isCategorySelected,
    }),
    [selectedCategory, setSelectedCategory, isCategorySelected],
  )

  return <QueryCategoryContext.Provider value={value}>{children}</QueryCategoryContext.Provider>
}

export function useQueryCategory(): QueryCategoryContextValue {
  const context = useContext(QueryCategoryContext)
  if (!context) {
    throw new Error('useQueryCategory must be used within a QueryCategoryProvider')
  }
  return context
}

export function useSelectedQueryCategory(): QueryCategory | null {
  const { selectedCategory } = useQueryCategory()
  return selectedCategory
}

export function useCategoryColor(category: QueryCategory | null): string {
  if (!category) return '#6b7280'
  const info = QUERY_CATEGORIES.find((c) => c.id === category)
  return info?.color ?? '#6b7280'
}
