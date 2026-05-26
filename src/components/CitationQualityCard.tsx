'use client'

// "Citation Quality" card for the Content Optimizer page. Scores the
// pasted text or fetched URL against the five Semrush AI-citation
// signals (clarity, EEAT, Q&A, structure, structured-data). Fires
// on-demand — operator clicks the button so the work + URL fetch only
// happens when wanted, not silently alongside every Analyze.

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loader2, SearchCheck, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PillarScore {
  score: number
  signals: string[]
  recommendation: string
}

interface CitationQualityReport {
  overall: number
  band: 'strong' | 'medium' | 'weak'
  pillars: {
    clarity: PillarScore
    eeat: PillarScore
    qa: PillarScore
    structure: PillarScore
    structuredData: PillarScore
  }
  topRecommendations: string[]
}

const PILLAR_LABELS: Record<keyof CitationQualityReport['pillars'], string> = {
  clarity: 'Clarity & Summary',
  eeat: 'E-E-A-T Signals',
  qa: 'Q&A Format',
  structure: 'Section Structure',
  structuredData: 'Structured Data',
}

// Semrush-measured citation correlation lifts — surfaced as context so
// operators understand WHY each pillar matters.
const PILLAR_LIFT: Record<keyof CitationQualityReport['pillars'], string> = {
  clarity: '+33% citation lift',
  eeat: '+30%',
  qa: '+25%',
  structure: '+23%',
  structuredData: '+22%',
}

function barColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-rose-500'
}

function bandColor(band: CitationQualityReport['band']): string {
  if (band === 'strong') return 'text-emerald-400'
  if (band === 'medium') return 'text-amber-300'
  return 'text-rose-400'
}

export function CitationQualityCard({ input, mode }: { input: string; mode: 'text' | 'url' }) {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<CitationQualityReport | null>(null)
  const [expanded, setExpanded] = useState<keyof CitationQualityReport['pillars'] | null>(null)

  async function run() {
    if (!input.trim()) return
    setRunning(true)
    setError(null)
    setReport(null)
    try {
      const res = await fetch('/api/citation-quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, mode }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.message || 'Scoring failed')
      setReport(j.data as CitationQualityReport)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scoring failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SearchCheck className="h-5 w-5 text-brand" />
          <div>
            <h2 className="text-lg font-bold text-foreground">Citation Quality Score</h2>
            <p className="text-xs text-muted-foreground">
              Probability your content gets cited by AI search engines (ChatGPT, Google AI Mode,
              Perplexity). Five signals weighted from a 300k-URL Semrush study.
            </p>
          </div>
        </div>
        <Button onClick={run} disabled={running || !input.trim()} size="sm">
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SearchCheck className="h-4 w-4" />
          )}
          {running ? 'Scoring…' : report ? 'Re-score' : 'Score citation quality'}
        </Button>
      </div>

      {error && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!report && !error && !running && (
        <p className="bg-input/30 mt-2 rounded-lg border border-input px-4 py-6 text-center text-sm text-muted-foreground">
          Click <b>Score citation quality</b> to grade the {mode === 'url' ? 'URL' : 'pasted text'}{' '}
          against the five Semrush-measured AI-citation signals.
        </p>
      )}

      {report && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
            {/* Overall */}
            <div className="bg-secondary/40 flex flex-col items-center justify-center rounded-xl border border-border p-4">
              <p className={cn('text-4xl font-black', bandColor(report.band))}>{report.overall}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">/ 100</p>
              <p
                className={cn(
                  'mt-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  report.band === 'strong'
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : report.band === 'medium'
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-rose-500/15 text-rose-300',
                )}
              >
                {report.band}
              </p>
            </div>

            {/* Pillars */}
            <div className="space-y-2">
              {(Object.keys(report.pillars) as Array<keyof CitationQualityReport['pillars']>).map(
                (key) => {
                  const pillar = report.pillars[key]
                  const isOpen = expanded === key
                  return (
                    <button
                      key={key}
                      onClick={() => setExpanded(isOpen ? null : key)}
                      className="bg-input/30 hover:bg-input/50 w-full rounded-lg border border-input px-3 py-2 text-left transition-colors"
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground">{PILLAR_LABELS[key]}</p>
                          <p className="text-[10px] text-muted-foreground">{PILLAR_LIFT[key]}</p>
                        </div>
                        <p
                          className={cn(
                            'shrink-0 text-sm font-black',
                            pillar.score >= 75
                              ? 'text-emerald-400'
                              : pillar.score >= 50
                                ? 'text-amber-300'
                                : 'text-rose-400',
                          )}
                        >
                          {pillar.score}
                        </p>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-border">
                        <div
                          className={cn('h-full transition-all', barColor(pillar.score))}
                          style={{ width: `${pillar.score}%` }}
                        />
                      </div>
                      {isOpen && (
                        <div className="mt-2 space-y-1">
                          {pillar.signals.map((s, i) => (
                            <p key={i} className="text-[11px] text-muted-foreground">
                              · {s}
                            </p>
                          ))}
                          <p className="bg-brand/10 mt-1 rounded px-2 py-1 text-[11px] text-brand">
                            ↳ {pillar.recommendation}
                          </p>
                        </div>
                      )}
                    </button>
                  )
                },
              )}
            </div>
          </div>

          {/* Top 3 recommendations — highest-leverage gaps first. */}
          <div className="mt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Top recommendations
            </p>
            <div className="space-y-1.5">
              {report.topRecommendations.map((rec, i) => (
                <div
                  key={i}
                  className="bg-input/30 flex items-start gap-2 rounded-lg border border-input px-3 py-2"
                >
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                  <p className="text-xs text-foreground">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  )
}
