// PATH: src/lib/export/cost-export.ts
//
// Pure, dependency-free serializers for the API-cost breakdown export
// (CSV / Excel / printable PDF-HTML). Kept free of `document`/`Blob` so they
// run server-side in the export route and are trivially unit-testable.
//
// Excel is emitted as SpreadsheetML 2003 (XML) — opens natively in Excel and
// Google Sheets with no third-party dependency, and unlike a bare .csv it
// preserves the numeric cost column as a real number (no sub-cent rounding).

import type { CostBreakdownRow, CostGranularity } from '@/lib/services/api-cost-overview'

export interface CostExportMeta {
  granularity: CostGranularity
  from: string
  to: string
  totalCostUsd: number
  totalCalls: number
  /** ISO timestamp the export was generated. */
  generatedAt?: string
}

const COLUMNS = [
  'Period',
  'Provider',
  'Calls',
  'Input Tokens',
  'Output Tokens',
  'Cost (USD)',
] as const

/** Full-precision USD: 4 decimals so accumulating sub-cent costs stay visible. */
function usd(n: number): string {
  return n.toFixed(4)
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10)
}

// ─── CSV ────────────────────────────────────────────────────────────────────

function csvCell(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function costRowsToCsv(rows: CostBreakdownRow[], meta: CostExportMeta): string {
  const lines: string[] = [
    csvCell(`AIO Pulse — API Cost Export (${meta.granularity})`),
    [csvCell('Range'), csvCell(dateOnly(meta.from)), csvCell(dateOnly(meta.to))].join(','),
    [csvCell('Generated'), csvCell(meta.generatedAt ?? new Date().toISOString())].join(','),
    '',
    COLUMNS.map(csvCell).join(','),
    ...rows.map((r) =>
      [r.bucket, r.provider, r.calls, r.inputTokens, r.outputTokens, usd(r.costUsd)]
        .map(csvCell)
        .join(','),
    ),
    '',
    [csvCell('TOTAL'), '', csvCell(meta.totalCalls), '', '', csvCell(usd(meta.totalCostUsd))].join(
      ',',
    ),
  ]
  // BOM so Excel opens UTF-8 correctly.
  return '﻿' + lines.join('\r\n')
}

// ─── Excel (SpreadsheetML 2003) ───────────────────────────────────────────────

function xmlEscape(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function xlCell(value: string | number, type: 'String' | 'Number'): string {
  return `<Cell><Data ss:Type="${type}">${xmlEscape(value)}</Data></Cell>`
}

function xlRow(cells: string): string {
  return `<Row>${cells}</Row>`
}

export function costRowsToExcelXml(rows: CostBreakdownRow[], meta: CostExportMeta): string {
  const header = xlRow(COLUMNS.map((c) => xlCell(c, 'String')).join(''))
  const body = rows
    .map((r) =>
      xlRow(
        xlCell(r.bucket, 'String') +
          xlCell(r.provider, 'String') +
          xlCell(r.calls, 'Number') +
          xlCell(r.inputTokens, 'Number') +
          xlCell(r.outputTokens, 'Number') +
          xlCell(Number(usd(r.costUsd)), 'Number'),
      ),
    )
    .join('')
  const total = xlRow(
    xlCell('TOTAL', 'String') +
      xlCell('', 'String') +
      xlCell(meta.totalCalls, 'Number') +
      xlCell('', 'String') +
      xlCell('', 'String') +
      xlCell(Number(usd(meta.totalCostUsd)), 'Number'),
  )

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="API Costs">
  <Table>
   ${header}
   ${body}
   ${total}
  </Table>
 </Worksheet>
</Workbook>`
}

// ─── Printable HTML (browser → PDF) ───────────────────────────────────────────

function htmlEscape(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function costRowsToHtml(rows: CostBreakdownRow[], meta: CostExportMeta): string {
  const body = rows
    .map(
      (r) => `<tr>
        <td>${htmlEscape(r.bucket)}</td>
        <td>${htmlEscape(r.provider)}</td>
        <td class="num">${htmlEscape(r.calls)}</td>
        <td class="num">${htmlEscape(r.inputTokens)}</td>
        <td class="num">${htmlEscape(r.outputTokens)}</td>
        <td class="num">$${htmlEscape(usd(r.costUsd))}</td>
      </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>AIO Pulse — API Cost Export</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.5; }
  h1 { font-size: 24px; font-weight: 800; margin-bottom: 4px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 10px 8px; background: #f5f5f5; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e5e5; }
  td { padding: 8px; border-bottom: 1px solid #eee; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight: 700; border-top: 2px solid #e5e5e5; background: #fafafa; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #999; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
  <h1>API Cost Export</h1>
  <div class="meta">
    ${htmlEscape(meta.granularity)} breakdown • ${htmlEscape(dateOnly(meta.from))} → ${htmlEscape(dateOnly(meta.to))}
    • generated ${htmlEscape((meta.generatedAt ?? new Date().toISOString()).slice(0, 16).replace('T', ' '))}
  </div>
  <table>
    <thead>
      <tr>${COLUMNS.map((c, i) => `<th${i >= 2 ? ' class="num"' : ''}>${htmlEscape(c)}</th>`).join('')}</tr>
    </thead>
    <tbody>${body || `<tr><td colspan="6" style="text-align:center;color:#999;padding:24px">No cost data in this range.</td></tr>`}</tbody>
    <tfoot>
      <tr>
        <td>TOTAL</td><td></td>
        <td class="num">${htmlEscape(meta.totalCalls)}</td>
        <td></td><td></td>
        <td class="num">$${htmlEscape(usd(meta.totalCostUsd))}</td>
      </tr>
    </tfoot>
  </table>
  <div class="footer">Generated by AIO Pulse • AI Search Visibility Platform</div>
  <script>window.onload = function () { window.print() }</script>
</body>
</html>`
}
