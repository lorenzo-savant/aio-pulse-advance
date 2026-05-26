// PATH: src/app/dashboard/audit/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  FileSearch,
  Globe,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Minus,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Shield,
  Bot,
  FileText,
  Code2,
  Tag,
  Zap,
  Layers,
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
import { ActionPlanPanel } from '@/components/ActionPlanPanel'
import { MentionInjectionPanel } from '@/components/MentionInjectionPanel'
import type { AuditResult as TechnicalAuditResult } from '@/lib/services/technical-seo-audit'
import { SectionHelp } from '@/components/help/SectionHelp'
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

interface TechAuditCheck {
  id: string
  name: string
  status: 'pass' | 'fail' | 'warning' | 'info'
  message: string
  details?: string
}

interface TechAuditCategory {
  score: number
  weight: number
  checks: TechAuditCheck[]
}

interface TechAuditResult {
  url: string
  timestamp: string
  overallScore: number
  categories: {
    aiCrawlerAccess: TechAuditCategory
    llmsTxt: TechAuditCategory
    schemaMarkup: TechAuditCategory
    metaTags: TechAuditCategory
    securityHeaders: TechAuditCategory
    performance: TechAuditCategory
    contentStructure: TechAuditCategory
  }
}

async function runTechnicalAudit(url: string): Promise<TechAuditResult> {
  const res = await fetch('/api/audit/technical', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.message || 'Technical audit failed')
  return data.data
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
        <span className="text-2xl font-black text-foreground">{score}</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
          / 100
        </span>
      </div>
      {label && <p className="text-xs font-bold text-muted-foreground">{label}</p>}
    </div>
  )
}

function getCategoryName(key: string): string {
  const names: Record<string, string> = {
    aiCrawlerAccess: 'AI Crawler Access',
    llmsTxt: 'llms.txt',
    schemaMarkup: 'Schema Markup',
    metaTags: 'Meta Tags',
    securityHeaders: 'Security Headers',
    performance: 'Performance (Core Web Vitals)',
    contentStructure: 'Content Structure',
  }
  return names[key] || key
}

function getCategoryIcon(key: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    aiCrawlerAccess: <Bot className="h-5 w-5" />,
    llmsTxt: <FileText className="h-5 w-5" />,
    schemaMarkup: <Code2 className="h-5 w-5" />,
    metaTags: <Tag className="h-5 w-5" />,
    securityHeaders: <Shield className="h-5 w-5" />,
    performance: <Zap className="h-5 w-5" />,
    contentStructure: <Layers className="h-5 w-5" />,
  }
  return icons[key] || <BarChart3 className="h-5 w-5" />
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'pass':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    case 'fail':
      return <XCircle className="h-4 w-4 text-red-500" />
    case 'warning':
      return <AlertCircle className="h-4 w-4 text-amber-500" />
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />
  }
}

function CategoryCard({
  id,
  name,
  icon,
  score,
  weight,
  checks,
  expanded,
  onToggle,
}: {
  id: string
  name: string
  icon: React.ReactNode
  score: number
  weight: number
  checks: TechAuditCheck[]
  expanded: boolean
  onToggle: () => void
}) {
  const scoreColor = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'
  const textColor =
    score >= 70 ? 'text-emerald-500' : score >= 40 ? 'text-amber-500' : 'text-red-500'

  return (
    <Card className="overflow-hidden">
      <button
        className="hover:bg-secondary/50 flex w-full cursor-pointer flex-col p-4 text-left transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg text-primary">
              {icon}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{name}</p>
              <p className="text-[10px] text-muted-foreground">
                Weight: {(weight * 100).toFixed(0)}%
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-lg font-black', textColor)}>{score}</span>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="bg-input-border mt-3 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className={cn('h-full rounded-full transition-all', scoreColor)}
            style={{ width: `${score}%` }}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-input px-4 py-3">
          <div className="space-y-2">
            {checks.map((check) => (
              <div key={check.id} className="flex items-start gap-2">
                {getStatusIcon(check.status)}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">{check.name}</p>
                  <p className="text-[10px] text-muted-foreground">{check.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  // Allow deep-linking from other surfaces (e.g. the GEO Score page) via
  // /dashboard/audit?url=<encoded>. Falls back to empty so direct visits
  // behave as before.
  const searchParams = useSearchParams()
  const [url, setUrl] = useState(() => searchParams?.get('url') ?? '')
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
  const [techLoading, setTechLoading] = useState(false)
  const [techResult, setTechResult] = useState<TechAuditResult | null>(null)
  const [techError, setTechError] = useState('')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

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

  const handleTechAudit = async () => {
    if (!url.trim()) return
    setTechLoading(true)
    setTechError('')
    setTechResult(null)
    try {
      const r = await runTechnicalAudit(url.trim())
      setTechResult(r)
    } catch (err) {
      setTechError(err instanceof Error ? err.message : 'Technical audit failed')
    } finally {
      setTechLoading(false)
    }
  }

  const toggleCategory = (id: string) => {
    setExpandedCategory(expandedCategory === id ? null : id)
  }

  return (
    <div className="space-y-6 bg-background">
      <SectionHelp section="audit" />
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight text-foreground">Content Audit</h1>
        <p className="mt-1 text-muted-foreground">
          Comprehensive AEO/GEO audit — analyze any URL for AI search engine readiness.
        </p>
      </div>

      {/* Input */}
      <Card className="p-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Globe className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="placeholder-text-muted-surface w-full rounded-xl border border-input bg-input py-3 pl-11 pr-4 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
          <Button
            size="lg"
            variant="secondary"
            loading={techLoading}
            onClick={handleTechAudit}
            disabled={!url.trim()}
          >
            <Shield className="h-5 w-5" />
            {techLoading ? 'Scanning...' : 'Tech Audit'}
          </Button>
        </div>
        {error && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
        {techError && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4" /> {techError}
          </div>
        )}
      </Card>

      {/* Technical SEO Audit Results */}
      {techResult && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">AI Technical Audit</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="flex flex-col items-center justify-center p-8">
              <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Overall Score
              </p>
              <div className="relative">
                <ScoreRing score={techResult.overallScore} size={160} />
              </div>
              <Badge
                variant={
                  techResult.overallScore >= 70
                    ? 'success'
                    : techResult.overallScore >= 40
                      ? 'warning'
                      : 'danger'
                }
                size="lg"
                className="mt-4"
              >
                {techResult.overallScore >= 70
                  ? 'Good'
                  : techResult.overallScore >= 40
                    ? 'Needs Work'
                    : 'Poor'}
              </Badge>
            </Card>

            <Card className="col-span-2 p-6">
              <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                URL Analyzed
              </p>
              <p className="break-all text-sm text-foreground">{techResult.url}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Scanned: {new Date(techResult.timestamp).toLocaleString()}
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(techResult.categories).map(([key, category]) => (
              <CategoryCard
                key={key}
                id={key}
                name={getCategoryName(key)}
                icon={getCategoryIcon(key)}
                score={category.score}
                weight={category.weight}
                checks={category.checks}
                expanded={expandedCategory === key}
                onToggle={() => toggleCategory(key)}
              />
            ))}
          </div>

          {/* Prioritised Today / This week / This month action plan derived
              from the audit findings — cheap-win M. */}
          <ActionPlanPanel audit={techResult as unknown as TechnicalAuditResult} />
        </div>
      )}

      {/* Previous Audits */}
      {history.length > 0 && !result && (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-bold text-foreground">Previous Audits</h3>
          <div className="space-y-2">
            {history.map((h) => (
              <button
                key={h.id}
                className="hover:bg-secondary-hover flex w-full items-center gap-3 rounded-lg border border-input bg-secondary px-3 py-2 text-left transition-all"
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
                        ? 'bg-primary/15 text-primary'
                        : 'bg-red-500/15 text-red-500'
                  }`}
                >
                  {h.visibility_score || 0}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{h.input}</p>
                  <p className="text-[10px] text-muted-foreground">
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
              <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
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
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {result.criticalIssues.length} critical · {result.warnings.length} warnings ·{' '}
                {result.passed.length} passed
              </p>
            </Card>

            {result.engineScores.length > 0 && (
              <Card className="p-6">
                <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
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
            <h2 className="mb-4 text-lg font-bold text-foreground">Category Breakdown</h2>
            <div className="space-y-4">
              {result.categories.map((cat) => (
                <div key={cat.name} className="rounded-xl border border-input p-4">
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
                        <p className="text-sm font-bold text-foreground">{cat.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Weight: {(cat.weight * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <div className="bg-input-border h-2 w-32 overflow-hidden rounded-full">
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
                          <p className="text-xs font-semibold text-muted-foreground">
                            {check.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{check.detail}</p>
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
                    <p className="text-xs text-muted-foreground">{issue.detail}</p>
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
              <h2 className="mb-4 text-lg font-bold text-foreground">Recommendations</h2>
              <div className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-xl border border-input p-3"
                  >
                    <span className="bg-primary/20 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-primary">
                      {i + 1}
                    </span>
                    <p className="text-sm text-muted-foreground">{rec}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Mention Injection Opportunities — paste your URLs + topic
              phrases, surface pages that discuss the topic without
              naming the brand. Semrush "LLM Visibility" playbook step 3. */}
          <MentionInjectionPanel />
        </div>
      )}
    </div>
  )
}
