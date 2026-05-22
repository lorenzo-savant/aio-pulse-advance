import { describe, it, expect } from 'vitest'
import {
  costRowsToCsv,
  costRowsToExcelXml,
  costRowsToHtml,
  type CostExportMeta,
} from '@/lib/export/cost-export'
import type { CostBreakdownRow } from '@/lib/services/api-cost-overview'

const rows: CostBreakdownRow[] = [
  {
    bucket: '2026-05-01',
    provider: 'openai',
    calls: 3,
    inputTokens: 100,
    outputTokens: 50,
    costUsd: 0.0123,
  },
  {
    bucket: '2026-05-01',
    provider: 'gemini',
    calls: 2,
    inputTokens: 80,
    outputTokens: 20,
    costUsd: 0.0007,
  },
]

const meta: CostExportMeta = {
  granularity: 'day',
  from: '2026-05-01T00:00:00.000Z',
  to: '2026-05-31T00:00:00.000Z',
  totalCostUsd: 0.013,
  totalCalls: 5,
  generatedAt: '2026-05-22T10:00:00.000Z',
}

describe('cost-export', () => {
  describe('costRowsToCsv', () => {
    it('preserves sub-cent precision (4 decimals) instead of flooring to whole cents', () => {
      const csv = costRowsToCsv(rows, meta)
      expect(csv).toContain('0.0123')
      expect(csv).toContain('0.0007') // would be "0" if rounded to cents
    })

    it('includes a UTF-8 BOM, header, and a TOTAL row', () => {
      const csv = costRowsToCsv(rows, meta)
      expect(csv.charCodeAt(0)).toBe(0xfeff)
      expect(csv).toContain('Period,Provider,Calls,Input Tokens,Output Tokens,Cost (USD)')
      expect(csv).toContain('TOTAL')
      expect(csv).toContain('0.0130')
    })

    it('escapes cells containing commas or quotes', () => {
      const tricky: CostBreakdownRow[] = [
        {
          bucket: '2026-05-01',
          provider: 'a,b"c',
          calls: 1,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
        },
      ]
      expect(costRowsToCsv(tricky, meta)).toContain('"a,b""c"')
    })
  })

  describe('costRowsToExcelXml', () => {
    it('emits SpreadsheetML with numeric cost cells at full precision', () => {
      const xml = costRowsToExcelXml(rows, meta)
      expect(xml).toContain('<?mso-application progid="Excel.Sheet"?>')
      expect(xml).toContain('urn:schemas-microsoft-com:office:spreadsheet')
      expect(xml).toContain('<Data ss:Type="Number">0.0123</Data>')
      expect(xml).toContain('<Data ss:Type="Number">0.0007</Data>')
    })

    it('escapes XML-significant characters', () => {
      const tricky: CostBreakdownRow[] = [
        {
          bucket: '2026-05-01',
          provider: 'x<y&z',
          calls: 1,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
        },
      ]
      expect(costRowsToExcelXml(tricky, meta)).toContain('x&lt;y&amp;z')
    })
  })

  describe('costRowsToHtml', () => {
    it('renders a printable table with totals and auto-print', () => {
      const html = costRowsToHtml(rows, meta)
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('$0.0007')
      expect(html).toContain('window.print()')
      expect(html).toContain('TOTAL')
    })

    it('shows an empty-state row when there is no data', () => {
      const html = costRowsToHtml([], meta)
      expect(html).toContain('No cost data in this range.')
    })
  })
})
