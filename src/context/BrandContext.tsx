'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import type { Brand } from '@/types'

interface BrandContextValue {
  brands: Brand[]
  selectedBrand: Brand | null
  isLoading: boolean
  error: string | null
  setBrands: (brands: Brand[]) => void
  selectBrand: (brand: Brand | null) => void
  selectBrandById: (id: string) => void
  refreshBrands: () => Promise<void>
}

const BrandContext = createContext<BrandContextValue | null>(null)

const STORAGE_KEY = 'aio-pulse-selected-brand-id'

export function BrandProvider({
  children,
  initialBrands = [],
}: {
  children: React.ReactNode
  initialBrands?: Brand[]
}) {
  const [brands, setBrands] = useState<Brand[]>(initialBrands)
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (initialBrands.length > 0) {
      setBrands(initialBrands)
    }
  }, [initialBrands])

  useEffect(() => {
    if (brands.length === 0 || initialized) return

    const storedId = localStorage.getItem(STORAGE_KEY)
    if (storedId) {
      const found = brands.find((b) => b.id === storedId)
      if (found) {
        setSelectedBrand(found)
      } else {
        setSelectedBrand(brands[0]!)
      }
    } else {
      setSelectedBrand(brands[0]!)
    }
    setInitialized(true)
  }, [brands, initialized])

  useEffect(() => {
    if (selectedBrand) {
      localStorage.setItem(STORAGE_KEY, selectedBrand.id)
    }
  }, [selectedBrand])

  const selectBrand = useCallback((brand: Brand | null) => {
    setSelectedBrand(brand)
    if (brand) {
      localStorage.setItem(STORAGE_KEY, brand.id)
    }
  }, [])

  const selectBrandById = useCallback(
    (id: string) => {
      const brand = brands.find((b) => b.id === id) || null
      setSelectedBrand(brand)
      if (brand) {
        localStorage.setItem(STORAGE_KEY, brand.id)
      }
    },
    [brands],
  )

  const refreshBrands = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/brands')
      if (!res.ok) throw new Error('Failed to fetch brands')
      const data = await res.json()
      setBrands(data.brands || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const value = useMemo(
    () => ({
      brands,
      selectedBrand,
      isLoading,
      error,
      setBrands,
      selectBrand,
      selectBrandById,
      refreshBrands,
    }),
    [brands, selectedBrand, isLoading, error, selectBrand, selectBrandById, refreshBrands],
  )

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
}

export function useBrand(): BrandContextValue {
  const context = useContext(BrandContext)
  if (!context) {
    throw new Error('useBrand must be used within a BrandProvider')
  }
  return context
}

export function useSelectedBrand(): Brand | null {
  const { selectedBrand } = useBrand()
  return selectedBrand
}

export function useBrandId(): string | null {
  const { selectedBrand } = useBrand()
  return selectedBrand?.id || null
}
