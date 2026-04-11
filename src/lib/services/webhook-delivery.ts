// PATH: src/lib/services/webhook-delivery.ts
import { createServerClient } from '@/lib/supabase'
import crypto from 'crypto'

const MAX_ATTEMPTS = 3
const RETRY_DELAYS_MS = [0, 30_000, 120_000] // immediate, 30s, 2min
const WEBHOOK_TIMEOUT_MS = 10_000
const WEBHOOK_SECRET = process.env.WEBHOOK_SIGNING_SECRET

function getWebhookSecret(): string {
  if (!WEBHOOK_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('WEBHOOK_SIGNING_SECRET must be set in production')
    }
    return 'dev-only-webhook-secret-do-not-use-in-production'
  }
  return WEBHOOK_SECRET
}

interface WebhookPayload {
  event_type: string
  event_id: string
  alert_rule_id: string
  brand_id: string
  title: string
  message: string
  data: Record<string, unknown>
  timestamp: number
}

function signPayload(payload: string): string {
  return crypto.createHmac('sha256', getWebhookSecret()).update(payload).digest('hex')
}

export async function deliverWebhook(
  url: string,
  alertEventId: string,
  alertRuleId: string,
  payload: WebhookPayload,
): Promise<{ success: boolean; logId: string | null }> {
  const db = createServerClient()
  const body = JSON.stringify(payload)
  const signature = signPayload(body)

  // Create delivery log entry
  let logId: string | null = null
  if (db) {
    try {
      const { data } = await (db as any)
        .from('webhook_delivery_logs')
        .insert({
          alert_event_id: alertEventId,
          alert_rule_id: alertRuleId,
          url,
          status: 'pending',
          attempts: 0,
        })
        .select('id')
        .single()
      logId = data?.id || null
    } catch (err) {
      console.error('[webhook] Failed to create delivery log:', err)
    }
  }

  // Attempt delivery with retries
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const delay = RETRY_DELAYS_MS[attempt] || 0
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay))
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AIO-Pulse-Event': payload.event_type,
          'X-AIO-Pulse-Signature': `sha256=${signature}`,
          'X-AIO-Pulse-Delivery': alertEventId,
          'X-AIO-Pulse-Timestamp': String(payload.timestamp),
        },
        body,
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      })

      const responseBody = await res.text().catch(() => '')

      if (db && logId) {
        await (db as any)
          .from('webhook_delivery_logs')
          .update({
            status: res.ok ? 'delivered' : 'failed',
            http_status: res.status,
            attempts: attempt + 1,
            last_attempt_at: new Date().toISOString(),
            response_body: responseBody.slice(0, 1000),
            error: res.ok ? null : `HTTP ${res.status}`,
          })
          .eq('id', logId)
      }

      if (res.ok) {
        return { success: true, logId }
      }

      // Don't retry on 4xx (except 429)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return { success: false, logId }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'

      if (db && logId) {
        const nextRetry =
          attempt + 1 < MAX_ATTEMPTS
            ? new Date(Date.now() + (RETRY_DELAYS_MS[attempt + 1] || 0)).toISOString()
            : null

        await (db as any)
          .from('webhook_delivery_logs')
          .update({
            status: attempt + 1 >= MAX_ATTEMPTS ? 'failed' : 'retrying',
            attempts: attempt + 1,
            last_attempt_at: new Date().toISOString(),
            next_retry_at: nextRetry,
            error: errorMsg,
          })
          .eq('id', logId)
      }

      if (attempt + 1 >= MAX_ATTEMPTS) {
        console.error(`[webhook] All ${MAX_ATTEMPTS} attempts failed for ${url}: ${errorMsg}`)
        return { success: false, logId }
      }
    }
  }

  return { success: false, logId }
}

export function buildWebhookPayload(
  event: { id: string; type: string; title: string; message: string; data: any; alert_rule_id: string; brand_id: string },
): WebhookPayload {
  return {
    event_type: event.type,
    event_id: event.id,
    alert_rule_id: event.alert_rule_id,
    brand_id: event.brand_id,
    title: event.title,
    message: event.message,
    data: event.data || {},
    timestamp: Date.now(),
  }
}
