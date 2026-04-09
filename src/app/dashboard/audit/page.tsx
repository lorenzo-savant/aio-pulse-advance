// PATH: src/app/dashboard/audit/page.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  FileSearch,
  Globe,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Minus,
  BarChart3,
  Loader2,
} from 'lucide-react'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditResult {
  url: string
  overallScore: number
  categories: AuditCategory[]
  engineScores: { engine: string; score: number }[]
  criticalIssues: AuditIssue[]
  warnings: AuditIssue[]
  passed: AuditIssue[]
  recommendations: string[]
}

interface AuditCategory {
  name: string
  score: number
  weight: number
  checks: AuditCheck[]
}

interface AuditCheck {
  name: string
  passed: boolean
  score: number
  detail: string
}

interface AuditIssue {
  title: string
  detail: string
  impact: 'critical' | 'warning' | 'pass'
  category: string
}

// ─── Audit Logic (client-side analysis via API) ──────────────────────────────

async function runAudit(url: string): Promise<AuditResult> {
  // Use the analyze API to get the content analysis
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: url, mode: 'url', engine: 'all', source: url }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.message || 'Analysis failed')

  const analysis = data.data

  // Transform the analysis into audit format
  const structureScore = Math.min(100, (analysis.engineBreakdown?.length || 0) * 25)
  const keywordScore = Math.min(100, (analysis.keywords?.length || 0) * 20)
  const intentScore = analysis.intentConfidence || 0
  const readabilityScore = getReadabilityScore(analysis.readingLevel)
  const citationScore = getCitationReadinessScore(analysis)

  const categories: AuditCategory[] = [
    {
      name: 'AI Discoverability',
      score: analysis.visibilityScore,
      weight: 0.3,
      checks: [
        {
          name: 'Content is parseable by AI',
          passed: analysis.visibilityScore > 30,
          score: analysis.visibilityScore,
          detail:
            analysis.visibilityScore > 30
              ? 'Content structure is AI-readable'
              : 'Content may be difficult for AI to parse',
        },
        {
          name: 'Engine optimization',
          passed: structureScore > 50,
          score: structureScore,
          detail: `Optimized for ${analysis.engineBreakdown?.length || 0} AI engines`,
        },
      ],
    },
    {
      name: 'Citation Readiness',
      score: citationScore,
      weight: 0.25,
      checks: [
        {
          name: 'Factual density',
          passed: citationScore > 60,
          score: citationScore,
          detail:
            citationScore > 60
              ? 'Good factual content for citations'
              : 'Increase factual density with data and statistics',
        },
        {
          name: 'Source authority signals',
          passed: analysis.toneConfidence > 60,
          score: analysis.toneConfidence || 0,
          detail: `Tone: ${analysis.tone} (${analysis.toneConfidence}% confidence)`,
        },
      ],
    },
    {
      name: 'Keyword Optimization',
      score: keywordScore,
      weight: 0.2,
      checks: [
        {
          name: 'Target keywords identified',
          passed: keywordScore > 40,
          score: keywordScore,
          detail: `${analysis.keywords?.length || 0} keywords identified`,
        },
        {
          name: 'Keyword impact scores',
          passed: (analysis.keywords?.[0]?.impact || 0) > 50,
          score: analysis.keywords?.[0]?.impact || 0,
          detail: analysis.keywords?.length
            ? `Top keyword: "${analysis.keywords[0].word}" (impact: ${analysis.keywords[0].impact})`
            : 'No keywords found',
        },
      ],
    },
    {
      name: 'Content Quality',
      score: readabilityScore,
      weight: 0.15,
      checks: [
        {
          name: 'Reading level appropriate',
          passed: readabilityScore > 50,
          score: readabilityScore,
          detail: `Reading level: ${analysis.readingLevel}`,
        },
        {
          name: 'Content type clarity',
          passed: analysis.contentTypeConfidence > 60,
          score: analysis.contentTypeConfidence || 0,
          detail: `Type: ${analysis.contentType} (${analysis.contentTypeConfidence}% confidence)`,
        },
      ],
    },
    {
      name: 'Intent Alignment',
      score: intentScore,
      weight: 0.1,
      checks: [
        {
          name: 'Clear user intent',
          passed: intentScore > 60,
          score: intentScore,
          detail: `Intent: ${analysis.intent} (${intentScore}% confidence)`,
        },
        {
          name: 'Intent signals present',
          passed: (analysis.intentSignals?.length || 0) > 1,
          score: Math.min(100, (analysis.intentSignals?.length || 0) * 33),
          detail: `${analysis.intentSignals?.length || 0} intent signals detected`,
        },
      ],
    },
  ]

  // Calculate overall
  const overallScore = Math.round(categories.reduce((sum, cat) => sum + cat.score * cat.weight, 0))

  // Build issues lists
  const criticalIssues: AuditIssue[] = []
  const warnings: AuditIssue[] = []
  const passed: AuditIssue[] = []

  categories.forEach((cat) => {
    cat.checks.forEach((check) => {
      const issue: AuditIssue = {
        title: check.name,
        detail: check.detail,
        impact: check.score < 30 ? 'critical' : check.score < 60 ? 'warning' : 'pass',
        category: cat.name,
      }
      if (issue.impact === 'critical') criticalIssues.push(issue)
      else if (issue.impact === 'warning') warnings.push(issue)
      else passed.push(issue)
    })
  })

  return {
    url,
    overallScore,
    categories,
    engineScores: (analysis.engineBreakdown || []).map((e: { engine: string; score: number }) => ({
      engine: e.engine,
      score: e.score,
    })),
    criticalIssues,
    warnings,
    passed,
    recommendations: analysis.suggestions || [],
  }
}

function getReadabilityScore(level: string): number {
  const scores: Record<string, number> = {
    Elementary: 95,
    'Middle School': 85,
    'High School': 75,
    Undergraduate: 65,
    Graduate: 45,
    Expert: 30,
  }
  return scores[level] || 50
}

function getCitationReadinessScore(analysis: any): number {
  let score = 0
  if (analysis.visibilityScore > 50) score += 30
  if (analysis.keywords?.length > 3) score += 25
  if (analysis.tone === 'Professional' || analysis.tone === 'Technical') score += 20
  if (analysis.intentConfidence > 60) score += 15
  if (analysis.contentTypeConfidence > 60) score += 10
  return Math.min(100, score)
}

// ─── Score Ring ──────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 120, label }: { score: number; size?: number; label?: string }) {
  const r = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#6366f1' : '#f43f5e'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-ring-track)"
          strokeWidth={8}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div
        className="absolute flex flex-col items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="text-2xl font-black text-text-on-surface">{score}</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted-surface">
          / 100
        </span>
      </div>
      {label && <p className="text-xs font-bold text-text-muted-surface">{label}</p>}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AuditResult | null>(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<
    Array<{
      id: string
      input: string
      visibility_score: number
      summary: string
      created_at: string
      raw_response: any
    }>
  >([])

  // Load URL-mode analysis history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch('/api/analyze?mode=url&limit=10')
        const d = await res.json()
        if (d.success && d.data?.length > 0) {
          setHistory(d.data)
        }
      } catch {
        // Silently fail
      }
    }
    loadHistory()
  }, [])

  const handleAudit = async () => {
    if (!url.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const r = await runAudit(url.trim())
      setResult(r)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 bg-page-bg">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight text-text-on-surface">Content Audit</h1>
        <p className="mt-1 text-text-muted-surface">
          Comprehensive AEO/GEO audit — analyze any URL for AI search engine readiness.
        </p>
      </div>

      {/* Input */}
      <Card className="p-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Globe className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted-surface" />
            <input
              className="w-full rounded-xl border border-surface-input-border bg-surface-input py-3 pl-11 pr-4 text-sm text-text-on-surface placeholder-text-muted-surface outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              placeholder="Enter URL to audit (e.g. https://yoursite.com/page)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAudit()}
            />
          </div>
          <Button size="lg" loading={loading} onClick={handleAudit} disabled={!url.trim()}>
            <FileSearch className="h-5 w-5" />
            {loading ? 'Auditing...' : 'Run Audit'}
          </Button>
        </div>
        {error && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
      </Card>

      {/* Previous Audits */}
      {history.length > 0 && !result && (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-bold text-text-on-surface">Previous Audits</h3>
          <div className="space-y-2">
            {history.map((h) => (
              <button
                key={h.id}
                className="flex w-full items-center gap-3 rounded-lg border border-surface-input-border bg-surface-row px-3 py-2 text-left transition-all hover:bg-surface-row-hover"
                onClick={() => {
                  setUrl(h.input || '')
                  if (h.input) {
                    setUrl(h.input)
                  }
                }}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                    (h.visibility_score || 0) >= 80
                      ? 'bg-emerald-500/15 text-emerald-500'
                      : (h.visibility_score || 0) >= 50
                        ? 'bg-brand-500/15 text-brand-500'
                        : 'bg-red-500/15 text-red-500'
                  }`}
                >
                  {h.visibility_score || 0}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-text-on-surface">{h.input}</p>
                  <p className="text-[10px] text-text-muted-surface">
                    {new Date(h.created_at).toLocaleString('sv-SE')} · Score:{' '}
                    {h.visibility_score || 'N/A'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Overall Score + Radar */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="flex flex-col items-center justify-center p-8">
              <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-text-muted-surface">
                Overall AEO Score
              </p>
              <div className="relative">
                <ScoreRing score={result.overallScore} size={160} />
              </div>
              <Badge
                variant={
                  result.overallScore >= 80
                    ? 'success'
                    : result.overallScore >= 50
                      ? 'warning'
                      : 'danger'
                }
                size="lg"
                className="mt-4"
              >
                {result.overallScore >= 80
                  ? 'Excellent'
                  : result.overallScore >= 50
                    ? 'Needs Improvement'
                    : 'Critical'}
              </Badge>
              <p className="mt-2 text-center text-xs text-text-muted-surface">
                {result.criticalIssues.length} critical · {result.warnings.length} warnings ·{' '}
                {result.passed.length} passed
              </p>
            </Card>

            {result.engineScores.length > 0 && (
              <Card className="p-6">
                <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-text-muted-surface">
                  Engine Readiness
                </p>
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart data={result.engineScores}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="engine" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Radar
                      dataKey="score"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>

          {/* Category Breakdown */}
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold text-text-on-surface">Category Breakdown</h2>
            <div className="space-y-4">
              {result.categories.map((cat) => (
                <div key={cat.name} className="rounded-xl border border-surface-input-border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg text-sm font-black',
                          cat.score >= 80
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : cat.score >= 50
                              ? 'bg-amber-500/15 text-amber-500'
                              : 'bg-red-500/15 text-red-500',
                        )}
                      >
                        {cat.score}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text-on-surface">{cat.name}</p>
                        <p className="text-[10px] text-text-muted-surface">
                          Weight: {(cat.weight * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <div className="h-2 w-32 overflow-hidden rounded-full bg-surface-input-border">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          cat.score >= 80
                            ? 'bg-emerald-500'
                            : cat.score >= 50
                              ? 'bg-amber-500'
                              : 'bg-red-500',
                        )}
                        style={{ width: `${cat.score}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {cat.checks.map((check) => (
                      <div key={check.name} className="flex items-start gap-2">
                        {check.passed ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                        )}
                        <div>
                          <p className="text-xs font-semibold text-text-secondary-surface">
                            {check.name}
                          </p>
                          <p className="text-[10px] text-text-muted-surface">{check.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Issues */}
          {result.criticalIssues.length > 0 && (
            <Card className="p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-red-500">
                <XCircle className="h-5 w-5" /> Critical Issues ({result.criticalIssues.length})
              </h2>
              <div className="space-y-2">
                {result.criticalIssues.map((issue, i) => (
                  <div key={i} className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                    <p className="text-sm font-bold text-red-400">{issue.title}</p>
                    <p className="text-xs text-text-muted-surface">{issue.detail}</p>
                    <Badge variant="danger" size="sm" className="mt-1">
                      {issue.category}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-bold text-text-on-surface">Recommendations</h2>
              <div className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-xl border border-surface-input-border p-3"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600/20 text-[10px] font-black text-brand-500">
                      {i + 1}
                    </span>
                    <p className="text-sm text-text-secondary-surface">{rec}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
