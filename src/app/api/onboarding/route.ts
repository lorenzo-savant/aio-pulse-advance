import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { slugify } from '@/lib/utils'

const schema = z.object({
  brandName: z.string().min(1).max(100),
  domain: z.string().url().optional().or(z.literal('')),
  industry: z.string().max(100).optional(),
  competitors: z.array(z.string()).max(10).optional().default([]),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .default('#0070F3'),
})

export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const data = schema.parse(body)
    const db = createServerClient()

    if (!db) {
      return NextResponse.json(
        { success: false, message: 'Database not configured' },
        { status: 503 },
      )
    }

    const slug = slugify(data.brandName)
    const now = new Date().toISOString()

    const { data: brand, error } = await db
      .from('brands')
      .insert({
        user_id: userId,
        name: data.brandName,
        slug,
        domain: data.domain || null,
        industry: data.industry || null,
        competitors: data.competitors,
        color: data.color,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .select('id, name, slug')
      .single()

    if (error) {
      if (error.message?.includes('unique')) {
        return NextResponse.json(
          { success: false, message: 'Brand already exists' },
          { status: 409 },
        )
      }
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        data: { brand },
        message: `Brand "${brand.name}" created`,
      },
      { status: 201 },
    )
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: 'Validation failed', errors: e.errors },
        { status: 422 },
      )
    }
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  const db = createServerClient()
  if (!db) {
    return NextResponse.json({ success: false, message: 'Database not configured' }, { status: 503 })
  }
  const { data: brands } = await db
    .from('brands')
    .select('id, name, slug, created_at')
    .eq('user_id', userId)

  return NextResponse.json({
    success: true,
    data: {
      totalBrands: brands?.length || 0,
      brands: brands || [],
      hasOnboarded: (brands?.length || 0) > 0,
    },
  })
}
