// PATH: src/app/api/alerts/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'

// ─── Webhook URL validator (blocca SSRF) ──────────────────────────────────────
function isSafeWebhookUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    const blocked = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '169.254.169.254', // AWS metadata
      'metadata.google.internal', // GCP metadata
    ]
    if (blocked.includes(hostname)) return false
    if (hostname.startsWith('192.168.')) return false
    if (hostname.startsWith('10.')) return false
    if (hostname.startsWith('172.16.') || hostname.startsWith('172.31.')) return false
    return true
  } catch {
    return false
  }
}

// ─── Validation schemas ───────────────────────────────────────────────────────

const alertConditionSchema = z.object({
  threshold: z.number().optional(),
  operator: z.enum(['gt', 'lt', 'gte', 'lte', 'eq']).optional(),
  engine: z.string().optional(),
  competitor: z.string().max(200).optional(),
  sentiment: z.string().optional(),
})

const createAlertSchema = z.object({
  brand_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: z.enum([
    'mention_new',
    'mention_lost',
    'sentiment_drop',
    'sentiment_spike',
    'competitor_ahead',
    'hallucination',
    'visibility_change',
    'citation_rate_change',
  ]),
  condition: alertConditionSchema,
  channels: z.array(z.string()).default(['email']),
  email: z.string().email().optional().nullable(),
  webhook_url: z
    .string()
    .url()
    .refine(isSafeWebhookUrl, 'Webhook URL must be a public internet address')
    .optional()
    .nullable(),
})

const updateAlertSchema = createAlertSchema.partial().omit({ brand_id: true })

// ─── Helper: auth + db setup ──────────────────────────────────────────────────
async function setup(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(
      req.headers.get('authorization'),
      req.headers.get('cookie'),
    )
    const db = createServerClient()
    if (!db) throw new Error('Database not configured')
    return { userId, db }
  } catch (e) {
    console.error('[alerts] Auth/setup error:', e)
    throw e
  }
}

// ─── Helper: standard error response ─────────────────────────────────────────
function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// ─── GET /api/alerts ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  let userId: string
  let db: ReturnType<typeof createServerClient>

  try {
    ;({ userId, db } = await setup(req))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const type = searchParams.get('type')

  if (type === 'events') {
    let query = db
      .from('alert_events')
      .select('*, brand:brands(name, color)')
      .eq('user_id', String(userId))
      .order('created_at', { ascending: false })
      .limit(100)

    if (brandId) query = query.eq('brand_id', brandId)

    const { data, error } = await query
    if (error) {
      console.error('[alerts] DB error (events):', error)
      return err(error.message)
    }
    return NextResponse.json({ success: true, data, timestamp: Date.now() })
  }

  let query = db
    .from('alert_rules')
    .select('*, brand:brands(name, color, slug)')
    .eq('user_id', String(userId))
    .order('created_at', { ascending: false })

  if (brandId) query = query.eq('brand_id', brandId)

  const { data, error } = await query
  if (error) {
    console.error('[alerts] DB error (rules):', error)
    return err(error.message)
  }
  return NextResponse.json({ success: true, data, timestamp: Date.now() })
}

// ─── POST /api/alerts ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let userId: string
  let db: ReturnType<typeof createServerClient>

  try {
    ;({ userId, db } = await setup(req))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const parsed = createAlertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    )
  }

  const { data: brand } = await db
    .from('brands')
    .select('id')
    .eq('id', parsed.data.brand_id)
    .eq('user_id', userId)
    .single()

  if (!brand) {
    return err('Brand not found or access denied', 404)
  }

  const { data, error } = await (db as any)
    .from('alert_rules')
    .insert({ ...parsed.data, user_id: userId, id: crypto.randomUUID() })
    .select()
    .single()

  if (error) return err(error.message)
  return NextResponse.json({ success: true, data, timestamp: Date.now() }, { status: 201 })
}

// ─── PUT /api/alerts ──────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  let userId: string
  let db: ReturnType<typeof createServerClient>

  try {
    ;({ userId, db } = await setup(req))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const action = searchParams.get('action')

  if (!id) return err('id query parameter is required', 400)

  if (action === 'read') {
    const { error } = await (db as any)
      .from('alert_events')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) return err(error.message)
    return NextResponse.json({ success: true, data: null, timestamp: Date.now() })
  }

  if (action === 'toggle') {
    const { data: rule } = await (db as any)
      .from('alert_rules')
      .select('is_active')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (!rule) return err('Alert rule not found', 404)

    const { data, error } = await (db as any)
      .from('alert_rules')
      .update({ is_active: !rule.is_active })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) return err(error.message)
    return NextResponse.json({ success: true, data, timestamp: Date.now() })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const parsed = updateAlertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    )
  }

  const { data, error } = await (db as any)
    .from('alert_rules')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) return err(error.message)
  return NextResponse.json({ success: true, data, timestamp: Date.now() })
}

// ─── DELETE /api/alerts ───────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  let userId: string
  let db: ReturnType<typeof createServerClient>

  try {
    ;({ userId, db } = await setup(req))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const type = searchParams.get('type')

  if (!id) return err('id query parameter is required', 400)

  const table = type === 'event' ? 'alert_events' : 'alert_rules'

  const { error } = await db.from(table).delete().eq('id', id).eq('user_id', userId)

  if (error) return err(error.message)
  return NextResponse.json({ success: true, data: null, timestamp: Date.now() })
}
