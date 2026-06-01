// PATH: src/lib/services/email.ts
import { Resend } from 'resend'
import { logger } from '@/lib/logger'
import {
  renderInvitationEmail,
  renderAlertEmail,
  normalizeLang,
  type EmailLang,
} from './email-templates'

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

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'AEO Pulse <onboarding@resend.dev>'

interface InvitationEmailParams {
  to: string
  brandName: string
  inviterName: string
  role: string
  acceptUrl: string
  /** Recipient language; falls back to 'en'. */
  lang?: string
}

export async function sendInvitationEmail({
  to,
  brandName,
  inviterName,
  role,
  acceptUrl,
  lang,
}: InvitationEmailParams): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('Resend not configured, skipping invitation email', { service: 'email' })
    return { success: false, error: 'Resend not configured' }
  }

  const language: EmailLang = normalizeLang(lang)
  const { subject, html } = renderInvitationEmail({
    lang: language,
    brandName,
    inviterName,
    role,
    acceptUrl,
  })

  try {
    // Resend returns errors in `result.error` (it does NOT throw on a rejected
    // send), so a try/catch alone silently swallows e.g. "domain not verified"
    // or "you can only send to your own address". Check the field explicitly.
    const result = await resend.emails.send({ from: FROM_EMAIL, to, subject, html })
    if (result.error) {
      const msg = result.error.message || String(result.error)
      logger.error('Invitation email rejected by Resend', { service: 'email', to, error: msg })
      return { success: false, error: msg }
    }
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('Error sending invitation email', { service: 'email', to, error: msg })
    return { success: false, error: msg }
  }
}

interface AlertEmailParams {
  to: string
  brandName: string
  alertType: string
  title: string
  message: string
  data?: Record<string, unknown>
  /** Recipient language; falls back to 'en'. */
  lang?: string
}

export async function sendAlertEmail({
  to,
  brandName,
  alertType,
  title,
  message,
  data,
  lang,
}: AlertEmailParams): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('Resend not configured, skipping alert email', { service: 'email' })
    return { success: false, error: 'Resend not configured' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const { subject, html } = renderAlertEmail({
    lang: normalizeLang(lang),
    brandName,
    alertType,
    title,
    message,
    data,
    appUrl,
  })

  try {
    const result = await resend.emails.send({ from: FROM_EMAIL, to, subject, html })
    if (result.error) {
      const msg = result.error.message || String(result.error)
      logger.error('Alert email rejected by Resend', { service: 'email', to, error: msg })
      return { success: false, error: msg }
    }
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('Error sending alert email', { service: 'email', to, error: msg })
    return { success: false, error: msg }
  }
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
  <title>Welcome to AEO Pulse</title>
</head>
<body style="margin:0;padding:0;background:#080d18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="margin-bottom:32px;">
      <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="width:32px;height:32px;background:#6366f1;border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:16px;font-weight:900;">A</span>
        </div>
        <span style="color:#e2e8f0;font-size:18px;font-weight:700;">AEO Pulse</span>
      </div>
      <p style="color:#64748b;font-size:13px;margin:0;">AI Search Visibility Platform</p>
    </div>

    <h1 style="color:#f8fafc;font-size:28px;font-weight:700;margin:0 0 16px 0;">
      Welcome to AEO Pulse, ${name}! 🚀
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
        © ${new Date().getFullYear()} AEO Pulse. All rights reserved.
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
      subject: `Welcome to AEO Pulse, ${name}!`,
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
        <span style="color:#e2e8f0;font-size:18px;font-weight:700;">AEO Pulse</span>
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
      subject: 'Reset Your AEO Pulse Password',
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
            This report was delivered automatically from AEO Pulse on the schedule you configured.
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
