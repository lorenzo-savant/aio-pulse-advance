import { NextResponse } from 'next/server'
import { getAllIndustryPresets } from '@/lib/services/prompt-generator'

export async function GET() {
  const presets = getAllIndustryPresets()
  const result = presets.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    competitors: p.competitors,
    seedKeywords: p.seedKeywords,
  }))
  return NextResponse.json({ success: true, data: result })
}
