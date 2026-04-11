'use client'

interface Brand {
  id: string
  name: string
}

interface BrandSelectorProps {
  brands: Brand[]
  selectedId: string
  onChange: (id: string) => void
  includeAll?: boolean
  allLabel?: string
  className?: string
}

export function BrandSelector({
  brands,
  selectedId,
  onChange,
  includeAll = false,
  allLabel = 'All Brands',
  className,
}: BrandSelectorProps) {
  if (brands.length <= 1 && !includeAll) return null

  return (
    <select
      className={
        className ||
        'rounded-xl border border-border bg-input px-4 py-2 text-sm text-foreground'
      }
      value={selectedId}
      onChange={(e) => onChange(e.target.value)}
    >
      {includeAll && <option value="">{allLabel}</option>}
      {brands.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  )
}
