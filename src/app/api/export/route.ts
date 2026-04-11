import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import Papa from 'papaparse'
import { jsPDF } from 'jspdf'
import { verifyBrandAccess } from '@/lib/authorize'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { logger } from '@/lib/logger'

interface BrandData {
  id: string
  name: string | null
  report_logo_url?: string | null
  report_brand_name?: string | null
  report_primary_color?: string | null
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex?.replace('#', '') || '6366f1'
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(cleanHex)
  if (!result) return { r: 99, g: 102, b: 241 }
  const r = parseInt(result[1] || '63', 16)
  const g = parseInt(result[2] || '66', 16)
  const b = parseInt(result[3] || 'f1', 16)
  return { r, g, b }
}

export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return NextResponse.json({ success: false, message: 'Authentication failed' })
  }

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`export:${ip}`, 30, 60_000)
  if (!rateCheck.success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    )
  }

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const format = searchParams.get('format') || 'csv'
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!brandId) {
    return NextResponse.json({ success: false, message: 'brand_id is required' }, { status: 400 })
  }

  // Validate date range - max 90 days
  if (from && to) {
    const fromDate = new Date(from)
    const toDate = new Date(to)
    const daysDiff = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
    if (daysDiff > 90) {
      return NextResponse.json(
        { success: false, message: 'Date range cannot exceed 90 days' },
        { status: 400 },
      )
    }
    if (daysDiff < 0) {
      return NextResponse.json({ success: false, message: 'Invalid date range' }, { status: 400 })
    }
  }

  // Validate format
  const validFormats = ['csv', 'json', 'pdf']
  if (!validFormats.includes(format)) {
    return NextResponse.json(
      { success: false, message: 'Invalid format. Use csv, json, or pdf' },
      { status: 400 },
    )
  }

  const db = createServerClient()
  if (!db) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  // Verify user has access to this brand (ownership or team membership)
  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) {
    return NextResponse.json(
      { success: false, message: 'Brand not found or access denied' },
      { status: 404 },
    )
  }

  const brandName = brand.name || 'Brand'
  const brandIdVal = brand.id
  const reportBrandName = brand.report_brand_name || 'AIO Pulse'
  const reportPrimaryColor = brand.report_primary_color || '#6366f1'
  const reportLogoUrl = brand.report_logo_url

  // Build date filter
  const fromDate =
    from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const toDate = to || new Date().toISOString().split('T')[0]

  // Query monitoring results
  const { data: results, error } = await db
    .from('monitoring_results')
    .select('*, prompt:prompts(text, category)')
    .eq('brand_id', brandIdVal)
    .gte('created_at', fromDate)
    .lte('created_at', toDate + 'T23:59:59')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }

  // Format data for export
  const exportData = (results || []).map((r: any) => ({
    date: new Date(r.created_at).toISOString().split('T')[0],
    engine: r.engine,
    prompt_text: r.prompt?.text || r.prompt_text || '',
    brand_mentioned: r.brand_mentioned ? 'Yes' : 'No',
    visibility_score: r.visibility_score,
    sentiment: r.sentiment || '',
    sentiment_score: r.sentiment_score || '',
    mention_position: r.mention_position || '',
    competitors: r.competitors_mentioned?.join(', ') || '',
  }))

  if (format === 'csv') {
    const csv = Papa.unparse(exportData)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${brandName}-export-${fromDate}-${toDate}.csv"`,
      },
    })
  }

  // PDF generation
  try {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Parse brand color (support hex only for now)
    const headerColor = reportPrimaryColor
      ? hexToRgb(reportPrimaryColor)
      : { r: 99, g: 102, b: 241 }

    // Header
    doc.setFillColor(headerColor.r, headerColor.g, headerColor.b)
    doc.rect(0, 0, pageWidth, 25, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(reportBrandName, 15, 16)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(`Brand Report: ${brandName}`, pageWidth - 15, 16, { align: 'right' })

    // Date range
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(10)
    doc.text(`Report Period: ${fromDate} to ${toDate}`, 15, 35)

    // Summary stats
    const totalScans = exportData.length
    const mentionedCount = exportData.filter((r: any) => r.brand_mentioned === 'Yes').length
    const mentionRate = totalScans > 0 ? ((mentionedCount / totalScans) * 100).toFixed(1) : '0.0'
    const avgVisibility =
      totalScans > 0
        ? (
            exportData.reduce((sum: number, r: any) => sum + (r.visibility_score || 0), 0) /
            totalScans
          ).toFixed(1)
        : '0.0'

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Executive Summary', 15, 50)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(`Total Scans: ${totalScans}`, 15, 60)
    doc.text(`Brand Mention Rate: ${mentionRate}%`, 15, 67)
    doc.text(`Average Visibility Score: ${avgVisibility}`, 15, 74)

    // Engine breakdown
    const engineStats: Record<string, { total: number; mentioned: number }> = {}
    exportData.forEach((r: any) => {
      const engine = r.engine || 'unknown'
      if (!engineStats[engine]) engineStats[engine] = { total: 0, mentioned: 0 }
      engineStats[engine].total++
      if (r.brand_mentioned === 'Yes') engineStats[engine].mentioned++
    })

    let yPos = 90
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Engine Breakdown', 15, yPos)
    yPos += 10

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    Object.entries(engineStats).forEach(([engine, stats]) => {
      const rate = ((stats.mentioned / stats.total) * 100).toFixed(1)
      doc.text(`${engine}: ${stats.mentioned}/${stats.total} mentions (${rate}%)`, 15, yPos)
      yPos += 7
    })

    // Table of recent results
    yPos += 10
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Recent Results', 15, yPos)
    yPos += 10

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('Date', 15, yPos)
    doc.text('Engine', 45, yPos)
    doc.text('Mentioned', 80, yPos)
    doc.text('Visibility', 110, yPos)
    doc.text('Sentiment', 145, yPos)
    yPos += 5
    doc.line(15, yPos, pageWidth - 15, yPos)
    yPos += 5

    doc.setFont('helvetica', 'normal')
    const recentResults = exportData.slice(0, 25)
    recentResults.forEach((r: any) => {
      if (yPos > 270) {
        doc.addPage()
        yPos = 20
      }
      doc.text(r.date.substring(0, 10), 15, yPos)
      doc.text(r.engine, 45, yPos)
      doc.text(r.brand_mentioned, 80, yPos)
      doc.text(String(r.visibility_score), 110, yPos)
      doc.text(r.sentiment || '-', 145, yPos)
      yPos += 6
    })

    // Footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(`Generated by ${reportBrandName} - Page ${i} of ${pageCount}`, pageWidth / 2, 290, {
        align: 'center',
      })
    }

    const pdfBuffer = doc.output('arraybuffer')
    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${brandName}-report-${fromDate}-${toDate}.pdf"`,
      },
    })
  } catch (pdfError) {
    logger.error('PDF generation error', { source: 'export', error: String(pdfError) })
    return NextResponse.json(
      {
        success: false,
        message: `PDF generation failed: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`,
      },
      { status: 500 },
    )
  }
}
