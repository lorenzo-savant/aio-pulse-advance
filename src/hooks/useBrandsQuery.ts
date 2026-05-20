'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Brand } from '@/types'

interface BrandsResponse {
  success: boolean
  data?: Brand[]
  message?: string
}

export function useBrandsQuery() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/brands')
      const text = await res.text()
      if (!text.trim()) {
        setBrands([])
        return
      }
      let json: BrandsResponse
      try {
        json = JSON.parse(text)
      } catch {
        throw new Error(`Server error (${res.status}): ${text.slice(0, 200)}`)
      }
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Server error ${res.status}`)
      }
      setBrands(json.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load brands')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data: brands, isLoading: loading, error, refetch }
}

export function useDeleteBrandMutation() {
  const [loading, setLoading] = useState(false)

  const mutateAsync = useCallback(async (id: string): Promise<void> => {
    setLoading(true)
    try {
      const res = await fetch(`/api/brands/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.message || `Delete failed: ${res.status}`)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  return { mutateAsync, isLoading: loading }
}
