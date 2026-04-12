// PATH: src/app/api/alerts/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'

// ─── Webhook URL validator (blocca SSRF) ──────────────────────────────────────
function isPrivateIp(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length === 4) {
    const [a, b] = parts
    if (a === undefined || b === undefined) return false
    // 127.0.0.0/8 (loopback)
    if (a === 127) return true
    // 0.0.0.0/8 (current network)
    if (a === 0) return true
    // 10.0.0.0/8 (private)
    if (a === 10) return true
    // 172.16.0.0/12 (private, including Docker)
    if (a === 172 && b >= 16 && b <= 31) return true
    // 192.168.0.0/16 (private)
    if (a === 192 && b === 168) return true
    // 100.64.0.0/10 (CGNAT, includes Alibaba metadata 100.100.100.200)
    if (a === 100 && b >= 64 && b <= 127) return true
    // 169.254.0.0/16 (link-local, includes AWS/GCP/Azure metadata)
    if (a === 169 && b === 254) return true
  }
  // IPv6 checks
  const lower = ip.toLowerCase()
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true
  // ULA (fc00::/7)
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  // Link-local (fe80::/10)
  if (lower.startsWith('fe80')) return true
  // IPv4-mapped IPv6
  if (lower.startsWith('::ffff:')) return true
  return false
}

function isSafeWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    // Block non-standard ports that hint at internal services
    if (parsed.port && !['80', '443', '8080', '8443'].includes(parsed.port)) return false
    const hostname = parsed.hostname
    // Block known internal hostnames
    const blockedHostnames = [
      'localhost',
      'metadata.google.internal',
      'metadata.goog',
      '169.254.169.254',
      'metadata.azure.com',
      '100.100.100.200', // Alibaba metadata
      'metadata.digitalocean.com',
    ]
    if (blockedHostnames.includes(hostname)) return false
    // Check for private IP ranges
    if (isPrivateIp(hostname)) return false
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
    logger.error('Auth/setup error', { source: 'alerts', error: String(e) })
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

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`alerts-get:${ip}`, 30, 60_000)
  if (!rateCheck.success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    )
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
      const msg = String((error as { message?: string })?.message ?? error)
      if (/does not exist|not found/i.test(msg)) {
        logger.warn('alert_events missing, returning empty', { source: 'alerts', msg })
        return NextResponse.json({
          success: true,
          data: [],
          timestamp: Date.now(),
          warning: 'alert_events table not yet migrated',
        })
      }
      logger.error('DB error (events)', { source: 'alerts', error: msg })
      return err(msg)
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
    const msg = String((error as { message?: string })?.message ?? error)
    if (/does not exist|not found/i.test(msg)) {
      logger.warn('alert_rules missing, returning empty', { source: 'alerts', msg })
      return NextResponse.json({
        success: true,
        data: [],
        timestamp: Date.now(),
        warning: 'alert_rules table not yet migrated',
      })
    }
    logger.error('DB error (rules)', { source: 'alerts', error: msg })
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

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`alerts-mut:${ip}`, 10, 60_000)
  if (!rateCheck.success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    )
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

  const { data, error } = await db
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

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`alerts-mut:${ip}`, 10, 60_000)
  if (!rateCheck.success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    )
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const action = searchParams.get('action')

  if (!id) return err('id query parameter is required', 400)

  if (action === 'read') {
    const { error } = await db
      .from('alert_events')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) return err(error.message)
    return NextResponse.json({ success: true, data: null, timestamp: Date.now() })
  }

  if (action === 'toggle') {
    const { data: rule } = await db
      .from('alert_rules')
      .select('is_active')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (!rule) return err('Alert rule not found', 404)

    const { data, error } = await db
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

  const { data, error } = await db
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

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`alerts-mut:${ip}`, 10, 60_000)
  if (!rateCheck.success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    )
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
