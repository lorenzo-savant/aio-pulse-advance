'use client'

import { useState, useMemo } from 'react'
import {
  Clock,
  Search,
  Trash2,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  AlertCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { useAppStore } from '@/lib/store'
import { exportHistoryToCsv, exportToJson } from '@/lib/export'
import { formatRelativeTime, formatDate, cn } from '@/lib/utils'
import type { ScanHistoryEntry, EngineId } from '@/types'

// ─── Score Ring Mini ──────────────────────────────────────────────────────────

function MiniRing({ score }: { score: number }) {
  const r = 18
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#6366f1' : '#f43f5e'
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: 46, height: 46 }}
    >
      <svg className="-rotate-90" height={46} width={46}>
        <circle
          cx={23}
          cy={23}
          fill="none"
          r={r}
          stroke="var(--color-ring-track)"
          strokeWidth="5"
        />
        <circle
          cx={23}
          cy={23}
          fill="none"
          r={r}
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="5"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <span className="absolute text-[10px] font-black text-foreground">{score}</span>
    </div>
  )
}

// ─── History Entry Card ───────────────────────────────────────────────────────

function HistoryCard({ entry, onDelete }: { entry: ScanHistoryEntry; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-2xl border border-input bg-secondary transition-all hover:bg-secondaryhover">
      {/* Header row */}
      <div className="flex items-center gap-4 p-4">
        <MiniRing score={entry.visibilityScore} />
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <Badge variant="brand">{entry.engine}</Badge>
            <Badge variant="default">{entry.type}</Badge>
            <Badge
              variant={
                entry.intent === 'Informational'
                  ? 'info'
                  : entry.intent === 'Commercial'
                    ? 'success'
                    : entry.intent === 'Transactional'
                      ? 'warning'
                      : 'default'
              }
            >
              {entry.intent}
            </Badge>
          </div>
          <p className="truncate text-sm font-semibold text-foreground">{entry.source}</p>
          <p className="text-[10px] text-muted-foreground">
            {formatRelativeTime(entry.timestamp)} · {formatDate(entry.timestamp)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="animate-in border-t border-input px-4 pb-4 pt-3">
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{entry.summary}</p>

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Type', value: entry.contentType },
              { label: 'Tone', value: entry.tone },
              { label: 'Level', value: entry.readingLevel },
              { label: 'Audience', value: entry.audience },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-lg border border-input bg-secondary p-2.5"
              >
                <p className="text-[9px] font-black uppercase tracking-wider text-foreground">
                  {label}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{value}</p>
              </div>
            ))}
          </div>

          {/* Engine breakdown */}
          {entry.engineBreakdown.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-surface-200">
                Engine Scores
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {entry.engineBreakdown.map((e) => (
                  <div
                    key={e.engine}
                    className="rounded-lg border border-input bg-secondary p-2"
                  >
                    <p className="text-[10px] text-muted-foreground">{e.engine}</p>
                    <p
                      className={cn(
                        'text-sm font-black',
                        e.score >= 80
                          ? 'text-emerald-400'
                          : e.score >= 50
                            ? 'text-brand-400'
                            : 'text-red-400',
                      )}
                    >
                      {e.score}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Keywords */}
          {entry.keywords.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-surface-200">
                Keywords
              </p>
              <div className="flex flex-wrap gap-1.5">
                {entry.keywords.map((k) => (
                  <span
                    key={k.word}
                    className="rounded-lg border border-input bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {k.word} <span className="text-brand-400">•{k.impact}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top suggestion */}
          {entry.suggestions[0] && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <p className="text-xs text-muted-foreground">{entry.suggestions[0]}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Filters ──────────────────────────────────────────────────────────────────

const ENGINE_OPTIONS: Array<{ label: string; value: 'all' | EngineId }> = [
  { label: 'All engines', value: 'all' },
  { label: 'ChatGPT', value: 'chatgpt' },
  { label: 'Gemini', value: 'gemini' },
  { label: 'Perplexity', value: 'perplexity' },
  { label: 'Claude', value: 'claude' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const { scanHistory, removeScan, clearHistory } = useAppStore()
  const [search, setSearch] = useState('')
  const [engineFilter, setEngineFilter] = useState<'all' | EngineId>('all')
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date')
  const [confirmClear, setConfirmClear] = useState(false)

  const filtered = useMemo(() => {
    return scanHistory
      .filter((s) => {
        const matchSearch = !search || s.source.toLowerCase().includes(search.toLowerCase())
        const matchEngine = engineFilter === 'all' || s.engine === engineFilter
        return matchSearch && matchEngine
      })
      .sort((a, b) =>
        sortBy === 'date' ? b.timestamp - a.timestamp : b.visibilityScore - a.visibilityScore,
      )
  }, [scanHistory, search, engineFilter, sortBy])

  const avgScore = useMemo(() => {
    if (scanHistory.length === 0) return 0
    return Math.round(scanHistory.reduce((a, s) => a + s.visibilityScore, 0) / scanHistory.length)
  }, [scanHistory])

  return (
    <div className="animate-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Scan History</h1>
          <p className="mt-1 text-muted-foreground">
            All your previous content analyses — searchable and filterable.
          </p>
        </div>
        {scanHistory.length > 0 && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => exportHistoryToCsv(scanHistory)}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportToJson(scanHistory, 'scan-history')}
            >
              <Download className="h-4 w-4" />
              JSON
            </Button>
            {confirmClear ? (
              <>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    clearHistory()
                    setConfirmClear(false)
                  }}
                >
                  Confirm clear
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)}>
                <Trash2 className="h-4 w-4" />
                Clear all
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Stats row */}
      {scanHistory.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Scans', value: scanHistory.length },
            { label: 'Avg. Score', value: `${avgScore}/100` },
            { label: 'Engines Used', value: [...new Set(scanHistory.map((s) => s.engine))].length },
          ].map(({ label, value }) => (
            <Card key={label} className="p-4 text-center">
              <p className="text-2xl font-black text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      {scanHistory.length > 0 && (
        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="w-full rounded-xl border border-input bg-input py-2 pl-10 pr-4 text-sm text-foreground placeholder-text-muted-surface outline-none focus:border-primary"
                placeholder="Search by source URL or text..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {ENGINE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-bold transition-all',
                    engineFilter === opt.value
                      ? 'border-brand-500/50 bg-primary/15 text-brand-400'
                      : 'border-input text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setEngineFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
              <select
                className="rounded-xl border border-input bg-input px-3 py-1.5 text-xs text-foreground outline-none"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'score')}
              >
                <option value="date">Sort: Date</option>
                <option value="score">Sort: Score</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {scanHistory.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-input bg-secondary">
            <Clock className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-foreground">No scans yet</h2>
          <p className="max-w-sm text-muted-foreground">
            Run your first analysis in the Content Optimizer and your results will appear here
            automatically.
          </p>
        </div>
      )}

      {/* Results */}
      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <HistoryCard key={entry.id} entry={entry} onDelete={() => removeScan(entry.id)} />
          ))}
        </div>
      )}

      {filtered.length === 0 && scanHistory.length > 0 && (
        <div className="py-12 text-center text-muted-foreground">
          No results match your filters.
        </div>
      )}
    </div>
  )
}
