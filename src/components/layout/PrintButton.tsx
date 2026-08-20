'use client'

import { Download } from 'lucide-react'

/**
 * Floating "download this page as PDF" control, rendered once by the dashboard
 * layout so every data page gets it for free.
 *
 * It triggers the browser's native print → "Save as PDF". That path renders the
 * REAL DOM — oklch colours, Recharts SVG, stat cards, comparison widgets —
 * exactly as shown. A client-side rasteriser (html2canvas) cannot: it throws on
 * this app's `oklch()` palette. The button hides itself in the printout.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-90 print:hidden"
      aria-label="Scarica questa pagina come PDF"
      title="Scarica come PDF"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">Scarica PDF</span>
    </button>
  )
}
