'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import JSZip from 'jszip'
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'

interface ExportButtonProps {
  brandId: string
  brandName: string
}

type ExportFormat = 'csv' | 'pdf' | 'obsidian' | 'markdown' | 'json'

interface ExportedNote {
  filename: string
  path: string
  content: string
}

// "notes" formats are built from the Markdown-notes payload (snapshots /
// hallucinations / prompt-tests). csv + pdf come straight from the
// /api/export endpoint over monitoring results, so the "Include" picker
// doesn't apply to them.
const NOTES_FORMATS: ExportFormat[] = ['obsidian', 'markdown', 'json']

const FORMATS: Array<{ id: ExportFormat; label: string; hint: string; ext: string }> = [
  {
    id: 'csv',
    label: 'CSV',
    hint: 'Spreadsheet of monitoring results (date, engine, mention, visibility, sentiment).',
    ext: 'csv',
  },
  {
    id: 'pdf',
    label: 'PDF report',
    hint: 'Branded summary report: mention rate, engine breakdown, recent results.',
    ext: 'pdf',
  },
  {
    id: 'obsidian',
    label: 'ZIP',
    hint: 'ZIP of Markdown notes with YAML frontmatter, organized in folders.',
    ext: 'zip',
  },
  {
    id: 'markdown',
    label: 'Single Markdown',
    hint: 'One .md file with every note concatenated. Good for quick reading or pasting.',
    ext: 'md',
  },
  {
    id: 'json',
    label: 'JSON',
    hint: 'Structured array of notes (path, filename, content). Good for programmatic use.',
    ext: 'json',
  },
]

export function ExportButton({ brandId, brandName }: ExportButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [format, setFormat] = useState<ExportFormat>('obsidian')

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  const [includeSnapshots, setIncludeSnapshots] = useState(true)
  const [includeHallucinations, setIncludeHallucinations] = useState(true)
  const [includePromptTests, setIncludePromptTests] = useState(true)

  const safeName = brandName.replace(/\s+/g, '-')

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const buildAndDownload = async (notes: ExportedNote[]) => {
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' })
      triggerDownload(blob, `${safeName}-export-${dateTo}.json`)
      return
    }

    if (format === 'markdown') {
      // Concatenate every note into a single document, separated by rules and
      // headed with the note path so the origin of each section is clear.
      const body = notes
        .map((n) => `<!-- ${n.path}${n.filename} -->\n\n${n.content.trim()}`)
        .join('\n\n---\n\n')
      const header = `# ${brandName} — Export\n\n_Range ${dateFrom} → ${dateTo} · ${notes.length} notes_\n\n---\n\n`
      const blob = new Blob([header + body + '\n'], { type: 'text/markdown' })
      triggerDownload(blob, `${safeName}-export-${dateTo}.md`)
      return
    }

    // ZIP preserving folder structure (Markdown notes with frontmatter)
    const zip = new JSZip()
    const baseFolder = `${safeName}-export/`
    for (const note of notes) {
      zip.folder(baseFolder + note.path)?.file(note.filename, note.content)
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    triggerDownload(zipBlob, `${safeName}-export-${dateTo}.zip`)
  }

  const handleExport = async () => {
    // CSV / PDF are produced server-side over monitoring results — just open
    // the download URL with the chosen date range. No "Include" picker.
    if (format === 'csv' || format === 'pdf') {
      const url = `/api/export?brand_id=${brandId}&format=${format}&from=${dateFrom}&to=${dateTo}`
      window.open(url, '_blank')
      setOpen(false)
      toast.success(`Export started (${format.toUpperCase()})`)
      return
    }

    const types: Array<'snapshot' | 'hallucination' | 'prompt-test'> = []
    if (includeSnapshots) types.push('snapshot')
    if (includeHallucinations) types.push('hallucination')
    if (includePromptTests) types.push('prompt-test')

    if (types.length === 0) {
      setError('Select at least one data type')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // The export API renders the data as Markdown notes; every format here
      // is derived from that same payload client-side.
      const res = await fetch('/api/export/obsidian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, brandName, dateFrom, dateTo, types }),
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.message || 'Export failed')
        return
      }

      await buildAndDownload(data.notes as ExportedNote[])

      setOpen(false)
      const fmtLabel = FORMATS.find((f) => f.id === format)?.label ?? 'file'
      toast.success(`Export downloaded (${fmtLabel})`)
    } catch (err) {
      console.error('Export error:', err)
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Download className="mr-2 h-4 w-4" />
        Export
      </Button>

      <Modal open={open} onOpenChange={setOpen} className="max-w-md">
        <ModalHeader>
          <ModalTitle>Export Data</ModalTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Export {brandName} monitoring data. Pick a format and a date range.
          </p>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Format
              </label>
              <div className="space-y-2">
                {FORMATS.map((f) => (
                  <label
                    key={f.id}
                    className="bg-secondary/50 flex cursor-pointer items-start gap-3 rounded-xl border border-border px-3 py-2.5"
                  >
                    <input
                      type="radio"
                      name="export-format"
                      checked={format === f.id}
                      onChange={() => setFormat(f.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                    />
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">{f.label}</span>
                      <span className="text-xs text-muted-foreground">{f.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  From Date
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  To Date
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            {NOTES_FORMATS.includes(format) ? (
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Include
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={includeSnapshots}
                      onChange={(e) => setIncludeSnapshots(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-sm text-foreground">Snapshots</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={includeHallucinations}
                      onChange={(e) => setIncludeHallucinations(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-sm text-foreground">Hallucinations</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={includePromptTests}
                      onChange={(e) => setIncludePromptTests(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-sm text-foreground">Prompt Tests</span>
                  </label>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {format === 'csv'
                  ? 'Exports all monitoring results in the date range as spreadsheet rows.'
                  : 'Generates a branded PDF report from monitoring results in the date range.'}
              </p>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download {FORMATS.find((f) => f.id === format)?.ext.toUpperCase()}
              </>
            )}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
