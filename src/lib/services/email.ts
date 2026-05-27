// PATH: src/lib/services/email.ts
import { Resend } from 'resend'
import { logger } from '@/lib/logger'

// Lazy init — see alerts.ts for rationale
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

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'AIO Pulse <onboarding@resend.dev>'

interface InvitationEmailParams {
  to: string
  brandName: string
  inviterName: string
  role: string
  acceptUrl: string
}

export async function sendInvitationEmail({
  to,
  brandName,
  inviterName,
  role,
  acceptUrl,
}: InvitationEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('Resend not configured, skipping invitation email', { service: 'email' })
    return { success: false, error: 'Resend not configured' }
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 40px; }
          .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 32px; }
          .header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
          .logo { width: 40px; height: 40px; background: #6366f1; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; }
          .title { font-size: 20px; font-weight: 600; color: white; }
          .message { font-size: 16px; line-height: 1.6; margin-bottom: 24px; }
          .details { background: #0f172a; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
          .detail-row { padding: 8px 0; border-bottom: 1px solid #334155; }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { color: #94a3b8; }
          .detail-value { color: #e2e8f0; font-weight: 500; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin-bottom: 24px; }
          .footer { text-align: center; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">A</div>
            <div class="title">Team Invitation</div>
          </div>
          
          <p class="message">You've been invited to join <strong>${brandName}</strong> on AIO Pulse.</p>
          
          <div class="details">
            <div class="detail-row">
              <span class="detail-label">Invited by:</span>
              <span class="detail-value">${inviterName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Role:</span>
              <span class="detail-value">${role}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Brand:</span>
              <span class="detail-value">${brandName}</span>
            </div>
          </div>
          
          <div style="text-align: center;">
            <a href="${acceptUrl}" class="button">Accept Invitation</a>
          </div>
          
          <div class="footer">
            <p>AIO Pulse - AI-Powered Brand Monitoring</p>
          </div>
        </div>
      </body>
    </html>
  `

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `You've been invited to join ${brandName} on AIO Pulse`,
      html,
    })
    return { success: true }
  } catch (error) {
    logger.error('Error sending invitation email', { service: 'email', error })
    return { success: false, error }
  }
}

interface AlertEmailParams {
  to: string
  brandName: string
  alertType: string
  title: string
  message: string
  data?: Record<string, unknown>
}

export async function sendAlertEmail({
  to,
  brandName,
  alertType,
  title,
  message,
  data,
}: AlertEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('Resend not configured, skipping alert email', { service: 'email' })
    return { success: false, error: 'Resend not configured' }
  }

  const alertTypeLabels: Record<string, string> = {
    mention_new: 'New Mention',
    mention_lost: 'Mention Lost',
    sentiment_drop: 'Sentiment Drop',
    sentiment_spike: 'Positive Spike',
    competitor_ahead: 'Competitor Leading',
    hallucination: 'Hallucination Detected',
    visibility_change: 'Visibility Change',
  }

  const subject = `[AIO Pulse] ${alertTypeLabels[alertType] || alertType}: ${brandName}`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 40px; }
          .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 32px; }
          .header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
          .logo { width: 40px; height: 40px; background: #6366f1; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; }
          .title { font-size: 20px; font-weight: 600; color: white; }
          .alert-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
          .alert-mention { background: #10b98120; color: #10b981; }
          .alert-danger { background: #ef444420; color: #ef4444; }
          .alert-warning { background: #f59e0b20; color: #f59e0b; }
          .alert-info { background: #3b82f620; color: #3b82f6; }
          .message { font-size: 16px; line-height: 1.6; margin-bottom: 24px; }
          .data { background: #0f172a; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
          .data-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #334155; }
          .data-row:last-child { border-bottom: none; }
          .data-label { color: #94a3b8; }
          .data-value { color: #e2e8f0; font-weight: 500; }
          .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">A</div>
            <div class="title">AIO Pulse Alert</div>
          </div>
          
          <span class="alert-badge ${getAlertBadgeClass(alertType)}">${alertTypeLabels[alertType] || alertType}</span>
          
          <h2 style="color: white; margin-bottom: 16px;">${title}</h2>
          
          <p class="message">${message}</p>
          
          ${
            data
              ? `
          <div class="data">
            ${Object.entries(data)
              .map(
                ([key, value]) => `
              <div class="data-row">
                <span class="data-label">${formatLabel(key)}</span>
                <span class="data-value">${String(value)}</span>
              </div>
            `,
              )
              .join('')}
          </div>
          `
              : ''
          }
          
          <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/alerts" class="button">View in Dashboard</a>
          </div>
          
          <div class="footer">
            <p>You're receiving this because you have an active alert rule for ${brandName}.</p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/settings" style="color: #6366f1;">Manage alerts</a></p>
          </div>
        </div>
      </body>
    </html>
  `

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    })
    return { success: true }
  } catch (error) {
    logger.error('Error sending alert email', { service: 'email', error })
    return { success: false, error }
  }
}

function getAlertBadgeClass(alertType: string): string {
  if (['mention_new', 'sentiment_spike'].includes(alertType)) return 'alert-mention'
  if (['sentiment_drop', 'hallucination', 'mention_lost'].includes(alertType)) return 'alert-danger'
  if (['competitor_ahead', 'visibility_change'].includes(alertType)) return 'alert-warning'
  return 'alert-info'
}

function formatLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

interface WelcomeEmailParams {
  to: string
  name: string
}

export async function sendWelcomeEmail({ to, name }: WelcomeEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('Resend not configured, skipping welcome email', { service: 'email' })
    return { success: false, error: 'Resend not configured' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aio-pulse.com'

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to AIO Pulse</title>
</head>
<body style="margin:0;padding:0;background:#080d18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="margin-bottom:32px;">
      <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="width:32px;height:32px;background:#6366f1;border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:16px;font-weight:900;">A</span>
        </div>
        <span style="color:#e2e8f0;font-size:18px;font-weight:700;">AIO Pulse</span>
      </div>
      <p style="color:#64748b;font-size:13px;margin:0;">AI Search Visibility Platform</p>
    </div>

    <h1 style="color:#f8fafc;font-size:28px;font-weight:700;margin:0 0 16px 0;">
      Welcome to AIO Pulse, ${name}! 🚀
    </h1>
    <p style="color:#94a3b8;font-size:16px;margin:0 0 24px 0;line-height:1.6;">
      Your account has been created successfully. You're now ready to start monitoring your brand's visibility in AI-powered search results.
    </p>

    <div style="background:#0f172a;border-radius:12px;padding:24px;margin-bottom:24px;">
      <h3 style="color:#f1f5f9;font-size:16px;font-weight:600;margin:0 0 16px 0;">Here's what you can do:</h3>
      
      <div style="display:flex;gap:12px;margin-bottom:16px;">
        <div style="width:40px;height:40px;background:#6366f120;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span style="font-size:20px;">📊</span>
        </div>
        <div>
          <p style="color:#e2e8f0;font-size:14px;font-weight:600;margin:0 0 4px 0;">Track Brand Visibility</p>
          <p style="color:#64748b;font-size:13px;margin:0;">Monitor how your brand appears in AI search results across engines.</p>
        </div>
      </div>
      
      <div style="display:flex;gap:12px;margin-bottom:16px;">
        <div style="width:40px;height:40px;background:#10b98120;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span style="font-size:20px;">🔔</span>
        </div>
        <div>
          <p style="color:#e2e8f0;font-size:14px;font-weight:600;margin:0 0 4px 0;">Set Up Alerts</p>
          <p style="color:#64748b;font-size:13px;margin:0;">Get notified when your brand mentions change or sentiment shifts.</p>
        </div>
      </div>
      
      <div style="display:flex;gap:12px;">
        <div style="width:40px;height:40px;background:#f59e0b20;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span style="font-size:20px;">📈</span>
        </div>
        <div>
          <p style="color:#e2e8f0;font-size:14px;font-weight:600;margin:0 0 4px 0;">Analyze Competitors</p>
          <p style="color:#64748b;font-size:13px;margin:0;">Compare your visibility against competitors and find opportunities.</p>
        </div>
      </div>
    </div>

    <div style="text-align:center;margin-bottom:32px;">
      <a href="${appUrl}/dashboard" style="display:inline-block;background:#6366f1;color:white;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">
        Go to Dashboard →
      </a>
    </div>

    <div style="border-top:1px solid #1e293b;padding-top:20px;text-align:center;">
      <p style="color:#475569;font-size:12px;margin:0 0 8px;">
        Need help? Reply to this email or visit our <a href="${appUrl}/docs" style="color:#6366f1;">docs</a>.
      </p>
      <p style="color:#334155;font-size:11px;margin:0;">
        © ${new Date().getFullYear()} AIO Pulse. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
`

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Welcome to AIO Pulse, ${name}!`,
      html,
    })
    return { success: true }
  } catch (error) {
    logger.error('Error sending welcome email', { service: 'email', error })
    return { success: false, error }
  }
}

interface PasswordResetEmailParams {
  to: string
  name: string
  resetUrl: string
}

export async function sendPasswordResetEmail({ to, name, resetUrl }: PasswordResetEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('Resend not configured, skipping password reset email', { service: 'email' })
    return { success: false, error: 'Resend not configured' }
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background:#080d18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="margin-bottom:32px;">
      <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="width:32px;height:32px;background:#6366f1;border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:16px;font-weight:900;">A</span>
        </div>
        <span style="color:#e2e8f0;font-size:18px;font-weight:700;">AIO Pulse</span>
      </div>
      <p style="color:#64748b;font-size:13px;margin:0;">AI Search Visibility Platform</p>
    </div>

    <h1 style="color:#f8fafc;font-size:24px;font-weight:700;margin:0 0 16px 0;">
      Reset Your Password
    </h1>
    <p style="color:#94a3b8;font-size:16px;margin:0 0 24px 0;line-height:1.6;">
      Hi ${name}, we received a request to reset your password. Click the button below to create a new password.
    </p>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${resetUrl}" style="display:inline-block;background:#6366f1;color:white;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">
        Reset Password →
      </a>
    </div>
    
    <p style="color:#64748b;font-size:14px;margin:0 0 24px 0;">
      This link will expire in 1 hour. If you didn't request this, please ignore this email.
    </p>

    <div style="border-top:1px solid #1e293b;padding-top:20px;text-align:center;">
      <p style="color:#475569;font-size:12px;margin:0;">
        Having trouble? Contact us at support@aio-pulse.com
      </p>
    </div>
  </div>
</body>
</html>
`

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Reset Your AIO Pulse Password',
      html,
    })
    return { success: true }
  } catch (error) {
    logger.error('Error sending password reset email', { service: 'email', error })
    return { success: false, error }
  }
}

interface ScheduledReportEmailParams {
  to: string[]
  brandName: string
  fromDate: string
  toDate: string
  pdfBuffer: Buffer
  /** Optional human label from the schedule (e.g. "Monthly client report"). */
  label?: string | null
}

/**
 * Deliver a white-label PDF report by email. Used by the cron-driven
 * report-delivery flow (/api/cron/report-delivery). One Resend call per
 * batch — recipients land in `to`, attachment is the rendered PDF.
 */
export async function sendScheduledReportEmail({
  to,
  brandName,
  fromDate,
  toDate,
  pdfBuffer,
  label,
}: ScheduledReportEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('Resend not configured, skipping scheduled report email', { service: 'email' })
    return { success: false, error: 'Resend not configured' }
  }
  if (to.length === 0) {
    return { success: false, error: 'No recipients' }
  }

  const subject = label
    ? `${label} — ${brandName} (${fromDate} → ${toDate})`
    : `${brandName} — AI Visibility Report (${fromDate} → ${toDate})`

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 32px;">
        <div style="max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 28px;">
          <h1 style="color: white; font-size: 22px; margin: 0 0 12px;">AI Visibility Report</h1>
          <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">
            Attached is the latest AI visibility report for <strong style="color: white;">${brandName}</strong>,
            covering ${fromDate} to ${toDate}.
          </p>
          <p style="font-size: 14px; color: #94a3b8;">
            This report was delivered automatically from AIO Pulse on the schedule you configured.
            Manage your schedule in the dashboard under <em>Reports → Scheduled deliveries</em>.
          </p>
        </div>
      </body>
    </html>
  `

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      attachments: [
        {
          filename: `${brandName.replace(/[^a-zA-Z0-9-]+/g, '-')}-${fromDate}-${toDate}.pdf`,
          content: pdfBuffer.toString('base64'),
        },
      ],
    })
    if (result.error) {
      return { success: false, error: result.error.message }
    }
    return { success: true, id: (result.data as { id?: string } | null)?.id }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function sendWebhookNotification(
  webhookUrl: string,
  payload: Record<string, unknown>,
) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        source: 'aio-pulse',
        timestamp: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`)
    }

    return { success: true }
  } catch (error) {
    logger.error('Webhook notification error', { service: 'email', error })
    return { success: false, error }
  }
}
