'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  TrendingUp,
  TrendingDown,
  Eye,
  Target,
  BarChart3,
  MessageSquare,
  Edit3,
  ExternalLink,
  Shield,
  Palette,
  Save,
  X,
  Users,
  UserPlus,
  Trash2,
  Mail,
  Check,
  FileText,
  Copy,
  Download,
  Globe,
  Sparkles,
  RefreshCw,
} from 'lucide-react'
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ExportButton } from '@/components/ExportButton'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Brand, MonitoringResult, BrandLanguage } from '@/types'
import { useChartTheme } from '@/hooks/useChartTheme'

const ENGINE_COLORS: Record<string, string> = {
  chatgpt: '#10b981',
  gemini: '#3b82f6',
  perplexity: '#a855f7',
  claude: '#f97316',
}

interface Snapshot {
  scan_date: string
  citation_count: number
  citation_rate: number
  avg_visibility: number
  avg_position: number | null
}

function StatCard({
  label,
  value,
  change,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  change?: number
  icon: React.ElementType
  color: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-black text-foreground">{value}</p>
          {change !== undefined && (
            <div
              className={cn(
                'mt-1 flex items-center gap-1 text-xs font-bold',
                change >= 0 ? 'text-emerald-400' : 'text-red-400',
              )}
            >
              {change >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {change >= 0 ? '+' : ''}
              {change}%
            </div>
          )}
        </div>
        <div className={cn('rounded-xl p-2', color)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  )
}

function ResultRow({ result }: { result: MonitoringResult }) {
  const engineColor = ENGINE_COLORS[result.engine] ?? '#6366f1'

  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-0">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-black uppercase"
        style={{ background: `${engineColor}20`, color: engineColor }}
      >
        {result.engine.slice(0, 3)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-muted-foreground">
          {result.prompt?.text || result.prompt_text || 'Unknown prompt'}
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(result.created_at).toLocaleDateString()}
        </p>
      </div>
      <div className="shrink-0 text-center">
        <p
          className={cn(
            'text-lg font-black',
            result.visibility_score >= 70
              ? 'text-emerald-400'
              : result.visibility_score >= 40
                ? 'text-primary'
                : 'text-red-400',
          )}
        >
          {result.visibility_score}
        </p>
      </div>
      <div className="shrink-0">
        {result.brand_mentioned ? (
          <Badge variant="success">Mentioned</Badge>
        ) : (
          <Badge variant="danger">Not found</Badge>
        )}
      </div>
    </div>
  )
}

export default function BrandDetailPage() {
  const router = useRouter()
  const params = useParams()
  const brandId = params.id as string
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const { tooltipStyle } = useChartTheme()

  const [brand, setBrand] = useState<Brand | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [results, setResults] = useState<MonitoringResult[]>([])
  const [loading, setLoading] = useState(true)
  const [domainAuthority, setDomainAuthority] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    report_brand_name: '',
    report_primary_color: '#6366f1',
    report_logo_url: '',
  })
  const [saving, setSaving] = useState(false)

  // LLMS generator state
  const [llmsModalOpen, setLlmsModalOpen] = useState(false)
  const [llmsLoading, setLlmsLoading] = useState(false)
  const [llmsFiles, setLlmsFiles] = useState<{
    'llms.txt': string
    'llms-full.txt': string
  } | null>(null)
  const [llmsInstructions, setLlmsInstructions] = useState<string[]>([])
  const [llmsActiveTab, setLlmsActiveTab] = useState<'llms.txt' | 'llms-full.txt'>('llms.txt')
  // When on, the file is auto-enriched from the website + AEO + keywords + AI.
  const [llmsEnrich, setLlmsEnrich] = useState(true)
  const [llmsEnrichment, setLlmsEnrichment] = useState<{
    scrape: { ok: boolean; pages: number; description: boolean; note?: string }
    aeo: { ok: boolean; faqs: number; note?: string }
    keywords: { ok: boolean; specialties: number; note?: string }
    ai: { ok: boolean; provider: string | null; products: number; note?: string }
  } | null>(null)

  // Team state
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [pendingInvites, setPendingInvites] = useState<any[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer')
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [brandRes, snapRes, monRes] = await Promise.all([
          fetch(`/api/brands/${brandId}`),
          fetch(`/api/snapshots?brand_id=${brandId}&engine=all&category=all`),
          fetch(`/api/monitoring?brand_id=${brandId}&limit=20`),
        ])

        const brandData = await brandRes.json()
        if (brandData.success) {
          setBrand(brandData.data)
        }

        const snapData = await snapRes.json()
        if (snapData.success && snapData.data) {
          setSnapshots(snapData.data)
        }

        const monData = await monRes.json()
        if (monData.success && monData.data) {
          setResults(monData.data)
        }

        // Calculate domain authority
        try {
          const daRes = await fetch('/api/domain-authority', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brand_id: brandId }),
          })
          const daData = await daRes.json()
          if (daData.success && daData.score != null) {
            setDomainAuthority(daData.score)
          }
        } catch {
          console.error('Failed to calculate domain authority')
        }
      } catch (err) {
        console.error('Failed to load brand data:', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [brandId])

  // Initialize edit form when brand loads
  useEffect(() => {
    if (brand) {
      setEditForm({
        report_brand_name: brand.report_brand_name || '',
        report_primary_color: brand.report_primary_color || '#6366f1',
        report_logo_url: brand.report_logo_url || '',
      })
    }
  }, [brand])

  const handleGenerateLlms = async () => {
    setLlmsLoading(true)
    setLlmsFiles(null)
    setLlmsInstructions([])
    setLlmsEnrichment(null)
    setLlmsModalOpen(true)
    try {
      const res = await fetch('/api/generate/llms-txt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, enrich: llmsEnrich }),
      })
      const data = await res.json()
      if (data.success) {
        setLlmsFiles(data.files)
        setLlmsInstructions(data.instructions)
        setLlmsEnrichment(data.enrichment ?? null)
      } else {
        toast.error(data.message || 'Failed to generate llms files')
      }
    } catch (err) {
      console.error('Failed to generate llms:', err)
      toast.error('Network error. Please try again.')
    } finally {
      setLlmsLoading(false)
    }
  }

  const handleCopyLlms = (filename: 'llms.txt' | 'llms-full.txt') => {
    if (llmsFiles) {
      navigator.clipboard.writeText(llmsFiles[filename])
      toast.success('Copied to clipboard')
    }
  }

  const handleDownloadLlms = (filename: 'llms.txt' | 'llms-full.txt') => {
    if (llmsFiles) {
      const blob = new Blob([llmsFiles[filename]], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  // Load team data
  const loadTeam = async () => {
    try {
      const res = await fetch(`/api/team?brand_id=${brandId}`)
      const data = await res.json()
      if (data.success) {
        setTeamMembers(data.data.members || [])
        setPendingInvites(data.data.pending_invitations || [])
      }
    } catch (err) {
      console.error('Failed to load team:', err)
    }
  }

  useEffect(() => {
    if (brandId) {
      loadTeam()
    }
  }, [brandId])

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: brandId,
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setInviteEmail('')
        loadTeam()
        toast.success(`Invitation sent to ${inviteEmail.trim()}`)
      } else {
        toast.error(data.message || 'Failed to send invitation')
      }
    } catch (err) {
      console.error('Failed to invite:', err)
      toast.error('Network error. Please try again.')
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (memberId: string, memberEmail?: string) => {
    const confirmed = await confirm({
      title: 'Remove team member?',
      description: memberEmail
        ? `Remove ${memberEmail} from this brand?`
        : 'Remove this team member from this brand?',
      confirmLabel: 'Remove',
      destructive: true,
    })
    if (!confirmed) return
    try {
      const res = await fetch(`/api/team?member_id=${memberId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        loadTeam()
        toast.success('Team member removed')
      } else {
        toast.error(data.message || 'Failed to remove member')
      }
    } catch (err) {
      console.error('Failed to remove member:', err)
      toast.error('Network error. Please try again.')
    }
  }

  const handleRemoveInvite = async (inviteId: string) => {
    try {
      const res = await fetch(`/api/team?invitation_id=${inviteId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        loadTeam()
        toast.success('Invitation cancelled')
      } else {
        toast.error(data.message || 'Failed to cancel invitation')
      }
    } catch (err) {
      console.error('Failed to remove invitation:', err)
      toast.error('Network error. Please try again.')
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: 'editor' | 'viewer') => {
    try {
      const res = await fetch(`/api/team?member_id=${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (data.success) {
        loadTeam()
        toast.success('Role updated')
      } else {
        toast.error(data.message || 'Failed to update role')
      }
    } catch (err) {
      console.error('Failed to update role:', err)
      toast.error('Network error. Please try again.')
    }
  }

  const handleSaveWhiteLabel = async () => {
    if (!brand) return
    setSaving(true)
    try {
      const res = await fetch(`/api/brands/${brand.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_brand_name: editForm.report_brand_name || null,
          report_primary_color: editForm.report_primary_color || null,
          report_logo_url: editForm.report_logo_url || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setBrand({ ...brand, ...editForm })
        setIsEditing(false)
      }
    } catch (err) {
      console.error('Failed to save white-label settings:', err)
    } finally {
      setSaving(false)
    }
  }

  // Calculate engine stats from results
  const engineStats = results.reduce(
    (acc, r) => {
      const engine = r.engine || 'unknown'
      if (!acc[engine]) {
        acc[engine] = { mentioned: 0, total: 0, visibility: 0 }
      }
      acc[engine].total++
      if (r.brand_mentioned) acc[engine].mentioned++
      acc[engine].visibility += r.visibility_score
      return acc
    },
    {} as Record<string, { mentioned: number; total: number; visibility: number }>,
  )

  const engineBreakdown = Object.entries(engineStats).map(([engine, stats]) => ({
    engine,
    mentioned: stats.mentioned,
    total: stats.total,
    rate: stats.total > 0 ? Math.round((stats.mentioned / stats.total) * 100) : 0,
    avgVisibility: stats.total > 0 ? Math.round(stats.visibility / stats.total) : 0,
  }))

  // Calculate KPI values
  const latestSnapshot = snapshots[snapshots.length - 1]
  const prevSnapshot = snapshots[snapshots.length - 2]

  const citationRate = latestSnapshot?.citation_rate ?? 0
  const citationChange =
    latestSnapshot && prevSnapshot
      ? Math.round(
          ((latestSnapshot.citation_rate - prevSnapshot.citation_rate) /
            (prevSnapshot.citation_rate || 1)) *
            100,
        )
      : 0

  const avgVisibility = latestSnapshot?.avg_visibility ?? 0
  const visibilityChange =
    latestSnapshot && prevSnapshot
      ? Math.round(
          ((latestSnapshot.avg_visibility - prevSnapshot.avg_visibility) /
            (prevSnapshot.avg_visibility || 1)) *
            100,
        )
      : 0

  const avgPosition = latestSnapshot?.avg_position ?? 0

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!brand) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Brand not found</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/brands')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Brands
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Language Nudge Banner - for brands without language set */}
      {(!brand.language || brand.language === 'en') &&
        brand.created_at &&
        new Date(brand.created_at) < new Date('2026-04-13') && (
          <div className="border-primary/30 bg-primary/10 flex items-center justify-between rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <span className="text-lg">📍</span>
              <p className="text-sm text-foreground">
                Set the primary market for this brand to get more accurate AI monitoring results.
              </p>
            </div>
            <Link href={`/dashboard/brands/${brand.id}/edit`}>
              <Button size="sm" variant="outline">
                Set Language
              </Button>
            </Link>
          </div>
        )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/brands"
            aria-label="Back to brands"
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-muted-foreground"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black"
              style={{ background: `${brand.color}20`, color: brand.color }}
            >
              {brand.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">{brand.name}</h1>
              {brand.domain && (
                <a
                  href={
                    /^https?:\/\//i.test(brand.domain) ? brand.domain : `https://${brand.domain}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
                >
                  {brand.domain}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {brand.industry && <Badge>{brand.industry}</Badge>}
          {/* All export formats (CSV / PDF / ZIP / Markdown / JSON) live in one
              control so the action bar reads as a single coherent group. */}
          {brand && <ExportButton brandId={brand.id} brandName={brand.name} />}
          <Button variant="outline" size="sm" onClick={handleGenerateLlms}>
            <FileText className="mr-2 h-4 w-4" />
            Generate llms.txt
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsEditing(true)
              document
                .getElementById('report-branding')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          >
            <Edit3 className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Domain Authority"
          value={domainAuthority > 0 ? domainAuthority.toFixed(1) : '-'}
          icon={Shield}
          color="bg-amber-500/20 text-amber-400"
        />
        <StatCard
          label="Citation Rate"
          value={`${citationRate}%`}
          change={citationChange}
          icon={Target}
          color="bg-emerald-500/20 text-emerald-400"
        />
        <StatCard
          label="Avg Position"
          value={avgPosition ? `#${avgPosition}` : '-'}
          icon={BarChart3}
          color="bg-blue-500/20 text-blue-400"
        />
        <StatCard
          label="Visibility Score"
          value={avgVisibility}
          change={visibilityChange}
          icon={Eye}
          color="bg-purple-500/20 text-purple-400"
        />
        <StatCard
          label="Total Scans"
          value={results.length}
          icon={MessageSquare}
          color="bg-orange-500/20 text-orange-400"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Citation Trend */}
        <Card className="p-6">
          <h3 className="mb-4 text-lg font-bold text-foreground">Citation Trend (30 days)</h3>
          {snapshots.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={snapshots}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="scan_date"
                  stroke="#6b7280"
                  fontSize={12}
                  tickFormatter={(v) =>
                    new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }
                />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip {...tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="citation_rate"
                  stroke={brand.color || '#6366f1'}
                  strokeWidth={2}
                  dot={false}
                  name="Citation Rate %"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[250px] items-center justify-center text-muted-foreground">
              No trend data available
            </div>
          )}
        </Card>

        {/* Engine Breakdown */}
        <Card className="p-6">
          <h3 className="mb-4 text-lg font-bold text-foreground">Engine Breakdown</h3>
          {engineBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={engineBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis type="number" stroke="#6b7280" fontSize={12} domain={[0, 100]} />
                <YAxis type="category" dataKey="engine" stroke="#6b7280" fontSize={12} width={80} />
                <Tooltip {...tooltipStyle} />
                <Bar
                  dataKey="rate"
                  fill={
                    engineBreakdown[0]?.engine
                      ? ENGINE_COLORS[engineBreakdown[0].engine]
                      : '#6366f1'
                  }
                  radius={[0, 4, 4, 0]}
                  name="Mention Rate %"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[250px] items-center justify-center text-muted-foreground">
              No engine data
            </div>
          )}
          available
        </Card>
      </div>

      {/* Recent Results */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Recent Monitoring Results</h3>
          <Link
            href={`/dashboard/monitoring?brand=${brandId}`}
            className="hover:text-brand-300 text-sm text-primary"
          >
            View all
          </Link>
        </div>
        {results.length > 0 ? (
          <div className="divide-y divide-gray-800">
            {results.slice(0, 10).map((result, i) => (
              <ResultRow key={result.id || i} result={result} />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            No monitoring results yet. Run a scan to see results.
          </div>
        )}
      </Card>

      {/* White-label Settings */}
      <Card id="report-branding" className="scroll-mt-24 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-bold text-foreground">White-label Report Settings</h3>
          </div>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit3 className="mr-2 h-4 w-4" />
              Configure
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false)
                  if (brand) {
                    setEditForm({
                      report_brand_name: brand.report_brand_name || '',
                      report_primary_color: brand.report_primary_color || '#6366f1',
                      report_logo_url: brand.report_logo_url || '',
                    })
                  }
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveWhiteLabel} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          )}
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Customize how your brand appears in PDF reports. Leave empty to use default AIO Pulse
          branding.
        </p>
        {isEditing ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Report Brand Name
              </label>
              <input
                className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary"
                placeholder="Your Company Name"
                value={editForm.report_brand_name}
                onChange={(e) => setEditForm({ ...editForm, report_brand_name: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Primary Color (Hex)
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  className="h-10 w-14 rounded-lg border border-border bg-transparent"
                  value={editForm.report_primary_color}
                  onChange={(e) =>
                    setEditForm({ ...editForm, report_primary_color: e.target.value })
                  }
                />
                <input
                  className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary"
                  placeholder="#6366f1"
                  value={editForm.report_primary_color}
                  onChange={(e) =>
                    setEditForm({ ...editForm, report_primary_color: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Logo URL (optional)
              </label>
              <input
                className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary"
                placeholder="https://your-company.com/logo.png"
                value={editForm.report_logo_url}
                onChange={(e) => setEditForm({ ...editForm, report_logo_url: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="bg-secondary/50 rounded-xl border border-border p-4">
              <p className="mb-1 text-xs text-muted-foreground">Report Brand Name</p>
              <p className="font-medium text-foreground">
                {brand?.report_brand_name || 'AIO Pulse (default)'}
              </p>
            </div>
            <div className="bg-secondary/50 rounded-xl border border-border p-4">
              <p className="mb-1 text-xs text-muted-foreground">Primary Color</p>
              <div className="flex items-center gap-2">
                <div
                  className="h-4 w-4 rounded"
                  style={{ background: brand?.report_primary_color || '#6366f1' }}
                />
                <p className="font-medium text-foreground">
                  {brand?.report_primary_color || '#6366f1'}
                </p>
              </div>
            </div>
            <div className="bg-secondary/50 rounded-xl border border-border p-4">
              <p className="mb-1 text-xs text-muted-foreground">Logo URL</p>
              <p className="font-medium text-foreground">
                {brand?.report_logo_url || 'Not configured'}
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Language Settings */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-bold text-foreground">Market Language</h3>
          </div>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Primary market language for prompts and AI monitoring. This determines which language is
          used when generating prompts and simulating AI responses.
        </p>
        <div className="flex flex-wrap gap-3">
          {[
            { code: 'en' as const, label: '🇬🇧 English' },
            { code: 'it' as const, label: '🇮🇹 Italiano' },
            { code: 'sv' as const, label: '🇸🇪 Svenska' },
          ].map((lang) => (
            <button
              key={lang.code}
              className={cn(
                'rounded-xl border px-4 py-2.5 text-sm font-medium transition-all',
                (brand?.language || 'en') === lang.code
                  ? 'bg-primary/10 border-primary text-foreground'
                  : 'border-border bg-secondary text-muted-foreground hover:border-primary',
              )}
              onClick={async () => {
                try {
                  const res = await fetch(`/api/brands/${brandId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ language: lang.code }),
                  })
                  const json = await res.json()
                  if (json.success) {
                    setBrand((prev) => (prev ? { ...prev, language: lang.code } : prev))
                    toast.success(`Language set to ${lang.label}`)
                  } else {
                    toast.error(json.message || 'Failed to update language')
                  }
                } catch {
                  toast.error('Failed to update language')
                }
              }}
            >
              {lang.label}
              {(brand?.language || 'en') === lang.code && (
                <Check className="ml-2 inline h-4 w-4 text-primary" />
              )}
            </button>
          ))}
        </div>
        {brand?.language === 'en' && (
          <p className="mt-3 text-xs text-muted-foreground">
            Note: Changing the language does not regenerate existing prompts. Use the prompt library
            to add new prompts in the selected language.
          </p>
        )}
      </Card>

      {/* Team Management */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-bold text-foreground">Team Members</h3>
          </div>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Invite team members to collaborate on this brand. They will receive an email invitation.
        </p>

        {/* Invite Form */}
        <div className="mb-6 flex flex-wrap gap-3">
          <input
            type="email"
            className="min-w-[200px] flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
          />
          <select
            className="rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
            <UserPlus className="mr-2 h-4 w-4" />
            {inviting ? 'Sending...' : 'Invite'}
          </Button>
        </div>

        {/* Team Members List */}
        <div className="space-y-3">
          {teamMembers.length === 0 && pendingInvites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members yet.</p>
          ) : (
            <>
              {/* Pending Invitations */}
              {pendingInvites.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Pending Invitations
                  </p>
                  {pendingInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="bg-secondary/30 flex items-center justify-between rounded-lg border border-border px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-foreground">{invite.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Invited as {invite.role} • Expires{' '}
                            {new Date(invite.expires_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveInvite(invite.id)}
                        aria-label="Cancel invitation"
                        className="text-muted-foreground hover:text-red-400"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Current Members */}
              {teamMembers.length > 0 && (
                <>
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Active Members
                  </p>
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="bg-secondary/30 flex items-center justify-between rounded-lg border border-border px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/20 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-primary">
                          {member.email?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm text-foreground">{member.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.role === 'owner' ? 'Owner' : member.role}
                            {member.status === 'pending' && ' • Pending'}
                          </p>
                        </div>
                      </div>
                      {member.role !== 'owner' && (
                        <div className="flex items-center gap-2">
                          <select
                            className="rounded-lg border border-border bg-secondary px-2 py-1 text-xs text-foreground"
                            value={member.role}
                            onChange={(e) =>
                              handleUpdateRole(member.id, e.target.value as 'editor' | 'viewer')
                            }
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                          </select>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id, member.email)}
                            aria-label="Remove team member"
                            className="text-muted-foreground hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </Card>

      {/* LLMS Generator Modal */}
      <Modal open={llmsModalOpen} onOpenChange={setLlmsModalOpen} className="max-w-3xl">
        <ModalHeader>
          <ModalTitle>LLMS Files Generator</ModalTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate llms.txt and llms-full.txt to improve AI visibility for {brand?.name}
          </p>
        </ModalHeader>
        <ModalBody>
          {/* Enrichment control — always visible so users can toggle + regenerate */}
          <div className="bg-secondary/50 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={llmsEnrich}
                onChange={(e) => setLlmsEnrich(e.target.checked)}
                disabled={llmsLoading}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
              />
              <span className="flex flex-col">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Enrich automatically
                </span>
                <span className="text-xs text-muted-foreground">
                  Pulls description &amp; links from the website, FAQs from AEO snippets,
                  specialties from keywords, and an AI-written summary (Groq).
                </span>
              </span>
            </label>
            <Button variant="outline" size="sm" onClick={handleGenerateLlms} disabled={llmsLoading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', llmsLoading && 'animate-spin')} />
              {llmsFiles ? 'Regenerate' : 'Generate'}
            </Button>
          </div>

          {llmsEnrichment && !llmsLoading && (
            <div className="mb-4 flex flex-wrap gap-2 text-xs">
              <span
                className={cn(
                  'rounded-md px-2 py-1',
                  llmsEnrichment.scrape.ok
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-secondary text-muted-foreground',
                )}
                title={llmsEnrichment.scrape.note}
              >
                Website:{' '}
                {llmsEnrichment.scrape.ok ? `${llmsEnrichment.scrape.pages} links` : 'none'}
              </span>
              <span
                className={cn(
                  'rounded-md px-2 py-1',
                  llmsEnrichment.aeo.ok
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-secondary text-muted-foreground',
                )}
                title={llmsEnrichment.aeo.note}
              >
                FAQ: {llmsEnrichment.aeo.faqs}
              </span>
              <span
                className={cn(
                  'rounded-md px-2 py-1',
                  llmsEnrichment.keywords.ok
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-secondary text-muted-foreground',
                )}
                title={llmsEnrichment.keywords.note}
              >
                Specialties: {llmsEnrichment.keywords.specialties}
              </span>
              <span
                className={cn(
                  'rounded-md px-2 py-1',
                  llmsEnrichment.ai.ok
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-secondary text-muted-foreground',
                )}
                title={llmsEnrichment.ai.note}
              >
                AI: {llmsEnrichment.ai.ok ? `${llmsEnrichment.ai.provider}` : 'off'}
              </span>
            </div>
          )}

          {llmsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Generating files...</span>
            </div>
          ) : llmsFiles ? (
            <>
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => setLlmsActiveTab('llms.txt')}
                  className={cn(
                    'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                    llmsActiveTab === 'llms.txt'
                      ? 'bg-primary text-white'
                      : 'hover:bg-secondary/80 bg-secondary text-muted-foreground',
                  )}
                >
                  llms.txt
                </button>
                <button
                  onClick={() => setLlmsActiveTab('llms-full.txt')}
                  className={cn(
                    'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                    llmsActiveTab === 'llms-full.txt'
                      ? 'bg-primary text-white'
                      : 'hover:bg-secondary/80 bg-secondary text-muted-foreground',
                  )}
                >
                  llms-full.txt
                </button>
              </div>
              <textarea
                readOnly
                value={llmsFiles[llmsActiveTab]}
                className="h-80 w-full resize-none rounded-xl border border-border bg-secondary px-4 py-3 font-mono text-sm text-foreground"
              />
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleCopyLlms(llmsActiveTab)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadLlms(llmsActiveTab)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
              <div className="bg-secondary/50 mt-6 rounded-xl border border-border p-4">
                <h4 className="mb-2 text-sm font-bold text-foreground">Deployment Instructions</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {llmsInstructions.map((instruction, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {instruction}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              Click "Generate llms.txt" to create the files
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setLlmsModalOpen(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      <ConfirmDialog />
    </div>
  )
}
