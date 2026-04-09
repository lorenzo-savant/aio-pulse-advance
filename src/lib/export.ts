import type { AnalysisResult, ScanHistoryEntry, MonitoringResult, Brand } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str
}

function row(...cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(escapeCsv).join(',')
}

function download(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

function today(): string {
  return new Date().toISOString().split('T')[0] ?? 'today'
}

// ─── Analysis CSV ─────────────────────────────────────────────────────────────

export function exportAnalysisToCsv(result: AnalysisResult): void {
  const lines = [
    row('AIO Pulse — Analysis Report', today()),
    row(),
    row('Source', result.source),
    row('Type', result.type),
    row('Visibility Score', result.visibilityScore),
    row('Intent', result.intent),
    row('Intent Confidence', `${result.intentConfidence}%`),
    row('Content Type', result.contentType),
    row('Tone', result.tone),
    row('Reading Level', result.readingLevel),
    row('Audience', result.audience),
    row(),
    row('Keywords'),
    row('Word', 'Impact (%)', 'Difficulty (/100)'),
    ...result.keywords.map((k) => row(k.word, k.impact, k.difficulty)),
    row(),
    row('Improvement Suggestions'),
    ...result.suggestions.map((s, i) => row(`${i + 1}.`, s)),
  ]
  download(lines.join('\n'), `AIO-Analysis-${today()}.csv`, 'text/csv;charset=utf-8;')
}

// ─── History CSV ──────────────────────────────────────────────────────────────

export function exportHistoryToCsv(history: ScanHistoryEntry[]): void {
  const header = row(
    'ID',
    'Date',
    'Source',
    'Type',
    'Engine',
    'Model',
    'Visibility',
    'Intent',
    'Intent Confidence',
    'Tone',
    'Reading Level',
  )
  const rows = history.map((e) =>
    row(
      e.id,
      new Date(e.timestamp).toLocaleString(),
      e.source,
      e.type,
      e.engine,
      e.model,
      e.visibilityScore,
      e.intent,
      `${e.intentConfidence}%`,
      e.tone,
      e.readingLevel,
    ),
  )
  download([header, ...rows].join('\n'), `AIO-History-${today()}.csv`, 'text/csv;charset=utf-8;')
}

// ─── JSON Export ──────────────────────────────────────────────────────────────

export function exportToJson<T>(data: T, filename: string): void {
  download(JSON.stringify(data, null, 2), `${filename}-${today()}.json`, 'application/json')
}

// ─── Brand Report CSV ─────────────────────────────────────────────────────────

export function exportBrandReportToCsv(brand: Brand, results: MonitoringResult[]): void {
  const lines = [
    row('AIO Pulse — Brand Report', today()),
    row('Brand', brand.name),
    row('Domain', brand.domain || ''),
    row('Industry', brand.industry || ''),
    row(),
    row('Summary'),
    row('Total Results', results.length),
    row(
      'Mention Rate',
      results.length > 0
        ? `${Math.round((results.filter((r) => r.brand_mentioned).length / results.length) * 100)}%`
        : '0%',
    ),
    row(
      'Avg Visibility',
      results.length > 0
        ? Math.round(results.reduce((a, r) => a + r.visibility_score, 0) / results.length)
        : 0,
    ),
    row(),
    row('Detailed Results'),
    row(
      'Date',
      'Engine',
      'Prompt',
      'Mentioned',
      'Position',
      'Visibility',
      'Sentiment',
      'Has Hallucination',
    ),
    ...results.map((r) =>
      row(
        new Date(r.created_at).toLocaleString(),
        r.engine,
        r.prompt_text.slice(0, 50),
        r.brand_mentioned ? 'Yes' : 'No',
        r.mention_position || '-',
        r.visibility_score,
        r.sentiment || '-',
        r.has_hallucination ? 'Yes' : 'No',
      ),
    ),
  ]
  download(lines.join('\n'), `${brand.slug}-report-${today()}.csv`, 'text/csv;charset=utf-8;')
}

// ─── Print Report ──────────────────────────────────────────────────────────────

export function printBrandReport(brand: Brand, results: MonitoringResult[]): void {
  const mentionRate =
    results.length > 0
      ? Math.round((results.filter((r) => r.brand_mentioned).length / results.length) * 100)
      : 0
  const avgScore =
    results.length > 0
      ? Math.round(results.reduce((a, r) => a + r.visibility_score, 0) / results.length)
      : 0

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(brand.name)} - AIO Pulse Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #e5e5e5; }
    .brand-info h1 { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
    .brand-info p { color: #666; font-size: 14px; }
    .date { font-size: 12px; color: #999; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 32px; }
    .stat { background: #f9f9f9; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 32px; font-weight: 800; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat.highlight { background: #6366f1; color: white; }
    .stat.highlight .stat-label { color: rgba(255,255,255,0.8); }
    .section { margin-bottom: 32px; }
    .section h2 { font-size: 18px; font-weight: 700; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e5e5e5; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 12px 8px; background: #f5f5f5; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 10px 8px; border-bottom: 1px solid #eee; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge.success { background: #d1fae5; color: #065f46; }
    .badge.danger { background: #fee2e2; color: #991b1b; }
    .badge.neutral { background: #f3f4f6; color: #4b5563; }
    .truncate { max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #999; text-align: center; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand-info">
      <h1>${escapeHtml(brand.name)}</h1>
      <p>${escapeHtml(brand.domain || 'No domain')}${brand.industry ? ` • ${escapeHtml(brand.industry)}` : ''}</p>
    </div>
    <div class="date">Generated: ${new Date().toLocaleDateString()}</div>
  </div>
  
  <div class="stats">
    <div class="stat highlight">
      <div class="stat-value">${results.length}</div>
      <div class="stat-label">Total Checks</div>
    </div>
    <div class="stat">
      <div class="stat-value">${mentionRate}%</div>
      <div class="stat-label">Mention Rate</div>
    </div>
    <div class="stat">
      <div class="stat-value">${avgScore}</div>
      <div class="stat-label">Avg Visibility</div>
    </div>
  </div>
  
  <div class="section">
    <h2>Recent Results</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Engine</th>
          <th>Prompt</th>
          <th>Mentioned</th>
          <th>Position</th>
          <th>Visibility</th>
          <th>Sentiment</th>
        </tr>
      </thead>
      <tbody>
        ${results
          .slice(0, 20)
          .map(
            (r) => `
        <tr>
          <td>${new Date(r.created_at).toLocaleDateString()}</td>
          <td>${escapeHtml(r.engine)}</td>
          <td class="truncate">${escapeHtml(r.prompt_text)}</td>
          <td><span class="badge ${r.brand_mentioned ? 'success' : 'danger'}">${r.brand_mentioned ? 'Yes' : 'No'}</span></td>
          <td>${r.mention_position || '-'}</td>
          <td>${r.visibility_score}</td>
          <td><span class="badge ${r.sentiment === 'positive' ? 'success' : r.sentiment === 'negative' ? 'danger' : 'neutral'}">${escapeHtml(r.sentiment || '-')}</span></td>
        </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
  </div>
  
  <div class="footer">
    Generated by AIO Pulse • AI Search Visibility Platform
  </div>
  
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>
  `

  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
  }
}
