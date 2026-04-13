'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Brand } from '@/types'

const KEY = ['brands'] as const

interface BrandsResponse {
  success: boolean
  data?: Brand[]
  message?: string
}

async function fetchBrands(): Promise<Brand[]> {
  const res = await fetch('/api/brands')
  const text = await res.text()
  if (!text.trim()) return []
  let json: BrandsResponse
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`Server error (${res.status}): ${text.slice(0, 200)}`)
  }
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Server error ${res.status}`)
  }
  return json.data ?? []
}

/** React Query version — full Brand type, cache-backed, devtools-visible. */
export function useBrandsQuery() {
  return useQuery({
    queryKey: KEY,
    queryFn: fetchBrands,
    staleTime: 30_000,
  })
}

export function useDeleteBrandMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await fetch(`/api/brands/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.message || `Delete failed: ${res.status}`)
      }
    },
    onMutate: async (id) => {
      // Optimistic update: remove from cache instantly
      await qc.cancelQueries({ queryKey: KEY })
      const previous = qc.getQueryData<Brand[]>(KEY)
      qc.setQueryData<Brand[]>(KEY, (old) => (old ?? []).filter((b) => b.id !== id))
      return { previous }
    },
    onError: (_err, _id, ctx) => {
      // Rollback if server failed
      if (ctx?.previous) qc.setQueryData(KEY, ctx.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: KEY })
    },
  })
}

export function useCreateBrandMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (brand: Partial<Brand>): Promise<Brand> => {
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brand),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Create failed: ${res.status}`)
      }
      return json.data as Brand
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY })
    },
  })
}

export const brandsQueryKey = KEY
