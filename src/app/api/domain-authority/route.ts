import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { calculateDomainAuthority } from '@/lib/services/domain-authority'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// ─── POST /api/domain-authority ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  let body: { brand_id?: string }
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  if (!body.brand_id) {
    return err('brand_id is required', 400)
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // Verify brand ownership
  const { data: brand } = await db
    .from('brands')
    .select('id')
    .eq('id', body.brand_id)
    .eq('user_id', userId)
    .single()

  if (!brand) {
    return err('Brand not found or access denied', 404)
  }

  try {
    const score = await calculateDomainAuthority(body.brand_id, userId)
    return NextResponse.json({ success: true, score })
  } catch (error) {
    console.error('[domain-authority] Error:', error)
    return err('Failed to calculate domain authority')
  }
}

// ─── GET /api/domain-authority ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')

  if (!brandId) {
    return err('brand_id is required', 400)
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // Verify brand ownership
  const { data: brand } = await db
    .from('brands')
    .select('id')
    .eq('id', brandId)
    .eq('user_id', userId)
    .single()

  if (!brand) {
    return err('Brand not found or access denied', 404)
  }

  try {
    const { data, error } = await db
      .from('brand_health_scores')
      .select('avi_score, date')
      .eq('brand_id', brandId)
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return NextResponse.json({ success: true, score: 0 })
    }

    return NextResponse.json({ success: true, score: data.avi_score || 0 })
  } catch (error) {
    console.error('[domain-authority] GET error:', error)
    return err('Failed to fetch domain authority')
  }
}
