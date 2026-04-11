'use client'

import { useState, useEffect } from 'react'

interface Brand {
  id: string
  name: string
  slug?: string
  domain?: string
  industry?: string
  color?: string
}

interface UseBrandsReturn {
  brands: Brand[]
  selectedBrand: Brand | null
  setSelectedBrand: (brand: Brand | null) => void
  selectBrandById: (id: string) => void
  loading: boolean
  error: string | null
}

export function useBrands(autoSelectFirst = true): UseBrandsReturn {
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/brands')
        const d = await res.json()
        const list: Brand[] = d.data || d || []
        if (!cancelled) {
          setBrands(list)
          if (autoSelectFirst && list.length > 0 && !selectedBrand) {
            setSelectedBrand(list[0]!)
          }
        }
      } catch {
        if (!cancelled) setError('Failed to load brands')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectBrandById = (id: string) => {
    const brand = brands.find((b) => b.id === id)
    if (brand) setSelectedBrand(brand)
  }

  return { brands, selectedBrand, setSelectedBrand, selectBrandById, loading, error }
}
