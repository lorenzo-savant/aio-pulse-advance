import type { AlertEvent, AlertRule, Brand, MonitoringResult } from '@/types'
import { Resend } from 'resend'
import { deliverWebhook, buildWebhookPayload } from './webhook-delivery'
import { logger } from '@/lib/logger'
import { renderAlertEmail, normalizeLang } from './email-templates'

// Lazy init — Resend constructor throws when called with undefined/placeholder.
// Keeping this lazy means modules that import alerts.ts (e.g. /api/monitoring)
// don't crash at module load time when RESEND_API_KEY isn't set.
let _resend: Resend | null = null
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key || key === 're_...' || key.startsWith('re_placeholder')) return null
  if (!_resend) _resend = new Resend(key)
  return _resend
}
const resend = {
  emails: {
    send: async (args: Parameters<Resend['emails']['send']>[0]) => {
      const client = getResend()
      if (!client) {
        return { data: null, error: { message: 'Resend not configured' } as { message: string } }
      }
      return client.emails.send(args)
    },
  },
} as unknown as Resend

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'AEO Pulse <onboarding@resend.dev>'

// ─── Resend mailer ───────────────────────────────────────────────────────────

interface EmailPayload {
  to: string
  subject: string
  html: string
}

async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('RESEND_API_KEY not set, skipping email', { service: 'alerts' })
    return false
  }

  try {
    // Resend surfaces failures in result.error (it does not throw), so check
    // it explicitly — otherwise a rejected send (unverified domain, etc.)
    // looks like success and the alert is silently lost.
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    })
    if ((result as { error?: { message?: string } | null }).error) {
      const msg =
        (result as { error?: { message?: string } | null }).error?.message || 'unknown error'
      logger.error('Alert email rejected by Resend', {
        service: 'alerts',
        to: payload.to,
        error: msg,
      })
      return false
    }
    return true
  } catch (error) {
    logger.error('Resend email error', { service: 'alerts', error })
    return false
  }
}

// ─── Email template ───────────────────────────────────────────────────────────
// Delegates to the shared brand-coherent template (light theme, teal wordmark,
// sv/it/en) keyed on the brand's language. Returns subject + html so the
// dispatcher uses one localized subject too.

function buildAlertEmail(event: AlertEvent, brand: Brand): { subject: string; html: string } {
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://aeo-pulse.savantmedia.se'
  return renderAlertEmail({
    lang: normalizeLang((brand as { language?: string | null }).language),
    brandName: brand.name,
    alertType: event.type,
    title: event.title,
    message: event.message,
    data: event.data as Record<string, unknown> | undefined,
    appUrl,
  })
}

// ─── Webhook sender (with HMAC signing, retry, and delivery logging) ─────────

async function sendWebhook(url: string, event: AlertEvent, ruleId: string): Promise<boolean> {
  const payload = buildWebhookPayload({
    id: event.id || 'unknown',
    type: event.type,
    title: event.title,
    message: event.message,
    data: event.data,
    alert_rule_id: ruleId,
    brand_id: event.brand_id,
  })
  const result = await deliverWebhook(url, event.id || 'unknown', ruleId, payload)
  return result.success
}

// ─── Alert dispatcher ─────────────────────────────────────────────────────────

export async function dispatchAlert(
  event: AlertEvent,
  rule: AlertRule,
  brand: Brand,
): Promise<string[]> {
  const channelsSent: string[] = []

  // Email
  if (rule.channels.includes('email') && rule.email) {
    const { subject, html } = buildAlertEmail(event, brand)
    const sent = await sendEmail({ to: rule.email, subject, html })
    if (sent) channelsSent.push('email')
  }

  // Webhook (with HMAC signing, retry, and delivery logging)
  if (rule.channels.includes('webhook') && rule.webhook_url) {
    const sent = await sendWebhook(rule.webhook_url, event, rule.id)
    if (sent) channelsSent.push('webhook')
  }

  return channelsSent
}

// ─── Alert condition evaluator ────────────────────────────────────────────────

export interface AlertTriggerContext {
  result: MonitoringResult
  previousResult?: MonitoringResult
  brand: Brand
  previousSnapshot?: { scan_date: string; citation_rate: number }
  currentSnapshot?: { scan_date: string; citation_rate: number }
}

export function shouldTriggerAlert(rule: AlertRule, ctx: AlertTriggerContext): boolean {
  const { result, previousResult } = ctx
  const { type, condition } = rule

  switch (type) {
    case 'mention_new':
      // Brand wasn't mentioned before, now it is
      return result.brand_mentioned && (previousResult ? !previousResult.brand_mentioned : true)

    case 'mention_lost':
      // Brand was mentioned before, now it isn't
      return !result.brand_mentioned && previousResult?.brand_mentioned === true

    case 'sentiment_drop': {
      if (!result.sentiment_score || !previousResult?.sentiment_score) return false
      const drop = previousResult.sentiment_score - result.sentiment_score
      const threshold = condition.threshold ?? 0.3
      return drop >= threshold
    }

    case 'sentiment_spike': {
      if (!result.sentiment_score || !previousResult?.sentiment_score) return false
      const rise = result.sentiment_score - previousResult.sentiment_score
      const threshold = condition.threshold ?? 0.3
      return rise >= threshold
    }

    case 'competitor_ahead': {
      const competitorName = condition.competitor
      if (!competitorName) return false
      const competitor = result.competitor_mentions.find(
        (c) => c.name.toLowerCase() === competitorName.toLowerCase(),
      )
      const brandPos = result.mention_position ?? 999
      const competitorPos = competitor?.position ?? 999
      return competitorPos < brandPos
    }

    case 'hallucination':
      return (
        result.has_hallucination &&
        result.hallucination_flags.some(
          (f) => !condition.threshold || ['medium', 'high'].includes(f.severity),
        )
      )

    case 'visibility_change': {
      if (!previousResult) return false
      const change = Math.abs(result.visibility_score - previousResult.visibility_score)
      const threshold = condition.threshold ?? 20
      return change >= threshold
    }

    case 'citation_rate_change': {
      if (!ctx.previousSnapshot || !ctx.currentSnapshot) return false
      const prevRate = ctx.previousSnapshot.citation_rate
      const currRate = ctx.currentSnapshot.citation_rate
      const change = Math.abs(currRate - prevRate)
      const threshold = condition.threshold ?? 10
      return change >= threshold
    }

    default:
      return false
  }
}

// ─── Alert event builder ──────────────────────────────────────────────────────

export function buildAlertEvent(
  rule: AlertRule,
  result: MonitoringResult,
  brand: Brand,
): Omit<AlertEvent, 'id' | 'created_at'> {
  const messages: Record<string, { title: string; message: string }> = {
    mention_new: {
      title: `${brand.name} mentioned on ${result.engine}`,
      message: `Your brand was mentioned in an AI response on ${result.engine} (position #${result.mention_position ?? 'unknown'}). Visibility score: ${result.visibility_score}/100.`,
    },
    mention_lost: {
      title: `${brand.name} no longer mentioned on ${result.engine}`,
      message: `Your brand is no longer appearing in AI responses for this prompt on ${result.engine}. Consider updating your content strategy.`,
    },
    sentiment_drop: {
      title: `Sentiment dropped for ${brand.name} on ${result.engine}`,
      message: `The sentiment toward ${brand.name} has dropped significantly. Current sentiment: ${result.sentiment} (score: ${result.sentiment_score?.toFixed(2)}).`,
    },
    competitor_ahead: {
      title: `Competitor leading ${brand.name} on ${result.engine}`,
      message: `A competitor is now being cited more prominently than ${brand.name} in AI responses on ${result.engine}.`,
    },
    hallucination: {
      title: `Hallucination detected for ${brand.name} on ${result.engine}`,
      message: `An AI system may be spreading false information about ${brand.name}. ${result.hallucination_flags.length} potential issue(s) flagged.`,
    },
    visibility_change: {
      title: `Visibility change detected for ${brand.name}`,
      message: `The visibility score for ${brand.name} on ${result.engine} has changed significantly. Current score: ${result.visibility_score}/100.`,
    },
    sentiment_spike: {
      title: `Positive sentiment spike for ${brand.name}`,
      message: `The sentiment toward ${brand.name} has improved significantly on ${result.engine}.`,
    },
    citation_rate_change: {
      title: `Citation rate change for ${brand.name}`,
      message: `The citation rate for ${brand.name} has changed significantly. Current visibility score: ${result.visibility_score}/100.`,
    },
  }

  const msg = messages[rule.type] ?? {
    title: rule.name,
    message: `Alert triggered for ${brand.name}.`,
  }

  return {
    alert_rule_id: rule.id,
    brand_id: brand.id,
    user_id: rule.user_id,
    type: rule.type,
    title: msg.title,
    message: msg.message,
    data: { result_id: result.id, engine: result.engine, score: result.visibility_score },
    channels_sent: [],
    is_read: false,
  }
}
