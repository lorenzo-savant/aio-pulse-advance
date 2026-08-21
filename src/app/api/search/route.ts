// PATH: src/app/api/search/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId } from '@/lib/supabase'
import { getAccessibleBrandIds } from '@/lib/authorize'
import { searchInternal } from '@/lib/services/search-index'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch {
    // Search only ever covers the caller's own brands, so there is nothing
    // public to return. Answering 200 with an empty list made an expired
    // session look like "you have nothing", which is the wrong thing to tell
    // someone whose data is sitting right there.
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
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

  // Meilisearch (opt-in) — typo-tolerant, ranked, multi-tenant. When it is
  // configured and returns hits, we use them directly. On any miss (unset env,
  // error, empty index, no match) we fall through to the ILIKE path below, so
  // the endpoint never returns worse results than before this integration.
  const indexed = await searchInternal(query, accessibleBrandIds, { limit: 10 })
  if (indexed && indexed.servedByIndex && indexed.hits.length > 0) {
    return NextResponse.json({ success: true, data: indexed.hits })
  }

  // The raw query used to be interpolated straight into the `.or()` filter
  // string. The surrounding `.in('id', accessibleBrandIds)` meant it could not
  // reach another tenant's rows, so this was never a data leak — but `,` and
  // `)` end a PostgREST filter term, and `%` / `_` are ILIKE wildcards, so a
  // query containing them either errored or silently matched far more than the
  // user typed. Strip the filter-grammar characters and escape the wildcards.
  const safeQuery = query.replace(/[(),."\\{};]/g, ' ').replace(/[%_]/g, (c) => `\\${c}`)
  if (!safeQuery.trim()) {
    return NextResponse.json({ success: true, data: [] })
  }

  // Search brands
  const { data: brands, error: brandsError } = await supabase
    .from('brands')
    .select('id, name')
    .in('id', accessibleBrandIds)
    .or(`name.ilike.%${safeQuery}%,aliases.cs.{${safeQuery}}`)
    .limit(5)

  // A failed query is not "nothing matched". Both branches only checked for
  // data, so any DB failure came back as an empty result set and the user was
  // told, in effect, that their brand does not exist.
  if (brandsError) {
    logger.error('search: brand query failed', { error: brandsError.message })
    return NextResponse.json({ success: false, message: 'Search failed' }, { status: 500 })
  }

  if (brands) {
    results.push(...brands.map((b: any) => ({ type: 'brand', id: b.id, name: b.name })))
  }

  // Search prompts
  const { data: prompts, error: promptsError } = await supabase
    .from('prompts')
    .select('id, text')
    .in('brand_id', accessibleBrandIds)
    .ilike('text', `%${safeQuery}%`)
    .limit(5)

  if (promptsError) {
    logger.error('search: prompt query failed', { error: promptsError.message })
    return NextResponse.json({ success: false, message: 'Search failed' }, { status: 500 })
  }

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
