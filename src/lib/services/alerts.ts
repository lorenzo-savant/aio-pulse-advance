import type { AlertEvent, AlertRule, Brand, MonitoringResult } from '@/types'
import { Resend } from 'resend'
import { deliverWebhook, buildWebhookPayload } from './webhook-delivery'
import { logger } from '@/lib/logger'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'AIO Pulse <onboarding@resend.dev>'

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
    await resend.emails.send({
      from: FROM_EMAIL,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    })
    return true
  } catch (error) {
    logger.error('Resend email error', { service: 'alerts', error })
    return false
  }
}

// ─── Email template ───────────────────────────────────────────────────────────

function buildAlertEmail(event: AlertEvent, brand: Brand): string {
  const from = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://aio-pulse.com'
  const typeEmoji: Record<string, string> = {
    mention_new: '🎯',
    mention_lost: '⚠️',
    sentiment_drop: '📉',
    sentiment_spike: '📈',
    competitor_ahead: '🏆',
    hallucination: '🚨',
    visibility_change: '👁️',
  }
  const emoji = typeEmoji[event.type] ?? '🔔'
  const severityColor: Record<string, string> = {
    mention_new: '#10b981',
    mention_lost: '#f59e0b',
    sentiment_drop: '#ef4444',
    sentiment_spike: '#10b981',
    competitor_ahead: '#f59e0b',
    hallucination: '#ef4444',
    visibility_change: '#6366f1',
  }
  const color = severityColor[event.type] ?? '#6366f1'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AIO Pulse Alert</title>
</head>
<body style="margin:0;padding:0;background:#080d18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">

    <!-- Header -->
    <div style="margin-bottom:32px;">
      <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="width:32px;height:32px;background:#6366f1;border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:16px;font-weight:900;">A</span>
        </div>
        <span style="color:#e2e8f0;font-size:18px;font-weight:700;">AIO Pulse</span>
      </div>
      <p style="color:#64748b;font-size:13px;margin:0;">AI Search Visibility Platform</p>
    </div>

    <!-- Alert Card -->
    <div style="background:#0f172a;border:1px solid ${color}40;border-radius:16px;padding:28px;margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <span style="font-size:28px;">${emoji}</span>
        <div>
          <p style="margin:0;font-size:11px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:${color};">
            ${event.type.replace(/_/g, ' ')}
          </p>
          <h1 style="margin:4px 0 0;font-size:22px;font-weight:900;color:#f1f5f9;line-height:1.2;">
            ${event.title}
          </h1>
        </div>
      </div>

      <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 20px;">
        ${event.message}
      </p>

      <!-- Brand pill -->
      <div style="display:inline-flex;align-items:center;gap:8px;background:${brand.color}15;border:1px solid ${brand.color}30;border-radius:999px;padding:6px 14px;">
        <div style="width:8px;height:8px;border-radius:50%;background:${brand.color};"></div>
        <span style="color:${brand.color};font-size:13px;font-weight:700;">${brand.name}</span>
      </div>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:32px;">
      <a href="${from}/dashboard/monitoring" style="display:inline-block;background:#6366f1;color:white;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;">
        View in Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #1e293b;padding-top:20px;text-align:center;">
      <p style="color:#475569;font-size:12px;margin:0 0 8px;">
        You received this alert because you set up monitoring for <strong style="color:#64748b;">${brand.name}</strong>.
      </p>
      <a href="${from}/dashboard/alerts" style="color:#6366f1;font-size:12px;text-decoration:none;">
        Manage alert settings
      </a>
    </div>
  </div>
</body>
</html>`
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
    const sent = await sendEmail({
      to: rule.email,
      subject: `${event.title} — AIO Pulse Alert`,
      html: buildAlertEmail(event, brand),
    })
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
