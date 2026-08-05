// PATH: src/app/api/search/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId } from '@/lib/supabase'
import { getAccessibleBrandIds } from '@/lib/authorize'

export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    // Return empty results for unauthenticated users (public search)
    return NextResponse.json({ success: true, data: [] })
  }

  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.toLowerCase() || ''

  if (query.length < 2) {
    return NextResponse.json({ success: true, data: [] })
  }

  const supabase = createServerClient()
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  const results: { type: string; id: string; name: string }[] = []

  // Search across everything the caller can reach, not only what they authored.
  const accessibleBrandIds = await getAccessibleBrandIds(supabase, userId)

  // Search brands
  const { data: brands } = await supabase
    .from('brands')
    .select('id, name')
    .in('id', accessibleBrandIds)
    .or(`name.ilike.%${query}%,aliases.cs.{${query}}`)
    .limit(5)

  if (brands) {
    results.push(...brands.map((b: any) => ({ type: 'brand', id: b.id, name: b.name })))
  }

  // Search prompts
  const { data: prompts } = await supabase
    .from('prompts')
    .select('id, text')
    .in('brand_id', accessibleBrandIds)
    .ilike('text', `%${query}%`)
    .limit(5)

  if (prompts) {
    results.push(
      ...prompts.map((p: any) => ({
        type: 'prompt',
        id: p.id,
        name: p.text.length > 50 ? p.text.slice(0, 50) + '...' : p.text,
      })),
    )
  }

  return NextResponse.json({ success: true, data: results })
}
