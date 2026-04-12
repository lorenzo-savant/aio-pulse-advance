import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { Resend } from 'resend'
import { logger } from '@/lib/logger'

// Lazy init — see src/lib/services/alerts.ts for rationale
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key || key === 're_...' || key.startsWith('re_placeholder')) return null
  return new Resend(key)
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

interface BrandData {
  id: string
  name: string | null
  user_id: string
  email: string | null
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET_TOKEN
  if (!cronSecret) {
    return NextResponse.json({ success: false, message: 'Server misconfigured' }, { status: 500 })
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  const db = createServerClient()
  if (!db) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  const fromEmail = process.env['RESEND_FROM_EMAIL'] || 'AIO Pulse <onboarding@resend.dev>'

  if (!process.env.RESEND_API_KEY) {
    logger.warn('RESEND_API_KEY not set, skipping digest', { source: 'digest' })
    return NextResponse.json({ success: false, message: 'Resend not configured' }, { status: 503 })
  }

  try {
    // Get date range for past week
    const today = new Date()
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fromDate = weekAgo.toISOString().split('T')[0]
    const toDate = today.toISOString().split('T')[0]

    // Get all active brands with alert email
    const { data: brands } = (await db
      .from('brands')
      .select('id, name, user_id, email')
      .eq('is_active', true)
      .not('email', 'is', null)) as { data: BrandData[] | null }

    if (!brands || brands.length === 0) {
      return NextResponse.json({ success: true, message: 'No brands with alerts' })
    }

    // Get unique user IDs
    const userIds = [...new Set(brands.map((b) => b.user_id))]

    let sentCount = 0
    let failCount = 0

    for (const userId of userIds) {
      const userBrands = brands.filter((b) => String(b.user_id) === userId)
      const userEmail = userBrands[0]?.email

      if (!userEmail) continue

      // Build digest for user
      const brandSummaries: string[] = []

      interface SnapshotData {
        scan_date: string
        citation_count: number
        citation_rate: number
        avg_visibility: number
      }

      for (const brand of userBrands) {
        // Get snapshots for the week
        const { data: snapshots } = (await db
          .from('citation_snapshots')
          .select('scan_date, citation_count, citation_rate, avg_visibility')
          .eq('project_id', brand.id)
          .eq('engine', 'all')
          .gte('scan_date', fromDate)
          .lte('scan_date', toDate)
          .order('scan_date', { ascending: true })) as { data: SnapshotData[] | null }

        // Get monitoring results count
        const { count: totalScans } = await db
          .from('monitoring_results')
          .select('*', { count: 'exact', head: true })
          .eq('brand_id', brand.id)
          .gte('created_at', weekAgo.toISOString())

        const { count: mentionedCount } = await db
          .from('monitoring_results')
          .select('*', { count: 'exact', head: true })
          .eq('brand_id', brand.id)
          .eq('brand_mentioned', true)
          .gte('created_at', weekAgo.toISOString())

        // Calculate mention rate
        const mentionRate =
          totalScans && totalScans > 0 && mentionedCount
            ? ((mentionedCount / totalScans) * 100).toFixed(1)
            : '0.0'

        // Calculate visibility trend
        let trend = 'stable'
        if (snapshots && snapshots.length >= 2) {
          const first = snapshots[0]?.avg_visibility || 0
          const last = snapshots[snapshots.length - 1]?.avg_visibility || 0
          const change = ((last - first) / (first || 1)) * 100
          if (change > 10) trend = 'up'
          else if (change < -10) trend = 'down'
        }

        const trendEmoji = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '➡️'

        brandSummaries.push(`
          <tr>
            <td style="padding:12px;border-bottom:1px solid #1f2937;">
              <strong style="color:#e2e8f0;">${brand.name || 'Brand'}</strong>
            </td>
            <td style="padding:12px;border-bottom:1px solid #1f2937;text-align:center;">
              ${totalScans || 0}
            </td>
            <td style="padding:12px;border-bottom:1px solid #1f2937;text-align:center;">
              ${mentionRate}%
            </td>
            <td style="padding:12px;border-bottom:1px solid #1f2937;text-align:center;">
              ${trendEmoji}
            </td>
          </tr>
        `)
      }

      if (brandSummaries.length === 0) continue

      // Build email HTML
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AIO Pulse Weekly Digest</title>
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

    <!-- Title -->
    <h1 style="color:#f8fafc;font-size:24px;font-weight:700;margin:0 0 8px 0;">
      Weekly Visibility Report
    </h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 24px 0;">
      ${fromDate} — ${toDate}
    </p>

    <!-- Summary Table -->
    <table style="width:100%;border-collapse:collapse;background:#0f172a;border-radius:12px;overflow:hidden;">
      <thead>
        <tr style="background:#1e293b;">
          <th style="padding:12px;text-align:left;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;">Brand</th>
          <th style="padding:12px;text-align:center;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;">Scans</th>
          <th style="padding:12px;text-align:center;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;">Mention Rate</th>
          <th style="padding:12px;text-align:center;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;">Trend</th>
        </tr>
      </thead>
      <tbody>
        ${brandSummaries.join('')}
      </tbody>
    </table>

    <!-- CTA -->
    <div style="margin-top:32px;text-align:center;">
      <a href="${process.env['NEXT_PUBLIC_APP_URL'] || 'https://aio-pulse.com'}/dashboard"
         style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        View Dashboard
      </a>
    </div>

    <!-- Footer -->
    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #1f2937;text-align:center;">
      <p style="color:#64748b;font-size:12px;margin:0;">
        Sent by <a href="${process.env['NEXT_PUBLIC_APP_URL'] || 'https://aio-pulse.com'}" style="color:#6366f1;">AIO Pulse</a>
      </p>
      <p style="color:#475569;font-size:11px;margin:8px 0 0 0;">
        Manage your alert preferences in Settings
      </p>
    </div>
  </div>
</body>
</html>
      `

      // Send email
      try {
        await resend.emails.send({
          from: fromEmail,
          to: userEmail,
          subject: `📊 AIO Pulse Weekly Digest — ${fromDate} to ${toDate}`,
          html,
        })
        sentCount++
      } catch (error) {
        logger.error('Failed to send digest', { source: 'digest', to: userEmail, error: String(error) })
        failCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${sentCount} digests, ${failCount} failed`,
    })
  } catch (error) {
    logger.error('Digest error', { source: 'digest', error: String(error) })
    return NextResponse.json({ success: false, message: 'Digest failed' }, { status: 500 })
  }
}
