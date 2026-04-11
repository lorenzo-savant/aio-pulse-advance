'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import JSZip from 'jszip'
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'

interface ObsidianExportButtonProps {
  brandId: string
  brandName: string
}

export function ObsidianExportButton({ brandId, brandName }: ObsidianExportButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const handleExport = async () => {
    const types: Array<'snapshot' | 'hallucination' | 'prompt-test'> = []
    if (includeSnapshots) types.push('snapshot')
    if (includeHallucinations) types.push('hallucination')
    if (includePromptTests) types.push('prompt-test')

    if (types.length === 0) {
      setError('Select at least one export type')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/export/obsidian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          brandName,
          dateFrom,
          dateTo,
          types,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.message || 'Export failed')
        return
      }

      const zip = new JSZip()
      const baseFolder = `${brandName.replace(/\s+/g, '-')}-obsidian-export/`

      for (const note of data.notes) {
        const folderPath = baseFolder + note.path
        zip.folder(folderPath)?.file(note.filename, note.content)
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${brandName.replace(/\s+/g, '-')}-obsidian-${dateTo}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setOpen(false)
      toast.success('Obsidian export downloaded')
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
        Export to Obsidian
      </Button>

      <Modal open={open} onOpenChange={setOpen} className="max-w-md">
        <ModalHeader>
          <ModalTitle>Export to Obsidian Vault</ModalTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Export {brandName} monitoring data as Markdown notes with YAML frontmatter for your
            Obsidian vault.
          </p>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
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
                Download ZIP
              </>
            )}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
