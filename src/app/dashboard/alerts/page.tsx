'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Bell,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Trophy,
  Eye,
  Trash2,
  Mail,
  Webhook,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { formatRelativeTime, cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Brand, AlertRule, AlertEvent, AlertType } from '@/types'

// ─── Alert type config ────────────────────────────────────────────────────────

const ALERT_TYPES: Array<{
  type: AlertType
  label: string
  desc: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}> = [
  {
    type: 'mention_new',
    label: 'New Mention',
    desc: 'Brand appears in AI response for first time',
    icon: CheckCircle2,
    color: 'emerald',
  },
  {
    type: 'mention_lost',
    label: 'Mention Lost',
    desc: 'Brand stops appearing in AI responses',
    icon: XCircle,
    color: 'amber',
  },
  {
    type: 'sentiment_drop',
    label: 'Sentiment Drop',
    desc: 'Negative sentiment spike detected',
    icon: TrendingDown,
    color: 'red',
  },
  {
    type: 'sentiment_spike',
    label: 'Positive Spike',
    desc: 'Significant positive sentiment increase',
    icon: TrendingUp,
    color: 'emerald',
  },
  {
    type: 'competitor_ahead',
    label: 'Competitor Leading',
    desc: 'Competitor cited more prominently',
    icon: Trophy,
    color: 'amber',
  },
  {
    type: 'hallucination',
    label: 'Hallucination',
    desc: 'False info detected about your brand',
    icon: AlertTriangle,
    color: 'red',
  },
  {
    type: 'visibility_change',
    label: 'Visibility Change',
    desc: 'Large score swing detected',
    icon: Eye,
    color: 'blue',
  },
  {
    type: 'citation_rate_change',
    label: 'Citation Rate Change',
    desc: 'Daily citation rate changed significantly',
    icon: TrendingUp,
    color: 'blue',
  },
]

const TYPE_COLOR_MAP: Record<string, string> = {
  mention_new: 'success',
  mention_lost: 'warning',
  sentiment_drop: 'danger',
  sentiment_spike: 'success',
  competitor_ahead: 'warning',
  hallucination: 'danger',
  visibility_change: 'info',
  citation_rate_change: 'info',
}

// ─── Event feed card ──────────────────────────────────────────────────────────

function EventCard({
  event,
  onMarkRead,
  onDelete,
}: {
  event: AlertEvent
  onMarkRead: (id: string) => void
  onDelete: (id: string) => void
}) {
  const typeConf = ALERT_TYPES.find((t) => t.type === event.type)
  const Icon = typeConf?.icon ?? Bell

  return (
    <div
      className={cn(
        'group flex items-start gap-4 rounded-2xl border p-4 transition-all',
        event.is_read
          ? 'border-border bg-surface-900/20'
          : 'border-brand-500/20 bg-primary/5',
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
          `text-${typeConf?.color ?? 'gray'}-400 bg-${typeConf?.color ?? 'gray'}-500/10`,
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          {!event.is_read && <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />}
          <p className="text-sm font-bold text-white">{event.title}</p>
          <Badge
            variant={
              (TYPE_COLOR_MAP[event.type] as Parameters<typeof Badge>[0]['variant']) ?? 'default'
            }
          >
            {event.type.replace(/_/g, ' ')}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{event.message}</p>
        <div className="mt-2 flex items-center gap-3">
          {event.brand && (
            <span className="text-[10px] text-muted-foreground">Brand: {event.brand.name}</span>
          )}
          {event.channels_sent.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              Sent via: {event.channels_sent.join(', ')}
            </span>
          )}
          <span className="text-[10px] text-white">{formatRelativeTime(event.created_at)}</span>
        </div>
      </div>

      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {!event.is_read && (
          <Button size="icon" variant="ghost" onClick={() => onMarkRead(event.id)}>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={() => onDelete(event.id)}>
          <Trash2 className="h-3.5 w-3.5 text-red-400" />
        </Button>
      </div>
    </div>
  )
}

// ─── Rule card ────────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  onToggle,
  onDelete,
}: {
  rule: AlertRule
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}) {
  const typeConf = ALERT_TYPES.find((t) => t.type === rule.type)
  const Icon = typeConf?.icon ?? Bell

  return (
    <div className="group flex items-center gap-4 rounded-2xl border border-border bg-surface-900/40 p-4 transition-all hover:border-border">
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          `text-${typeConf?.color ?? 'gray'}-400`,
          rule.is_active ? `bg-${typeConf?.color ?? 'gray'}-500/10` : 'bg-surface-800',
        )}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <p className="font-bold text-white">{rule.name}</p>
          {rule.is_active ? (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-surface-600" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">{typeConf?.desc}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {rule.brand && (
            <span className="text-[10px] text-muted-foreground">Brand: {rule.brand.name}</span>
          )}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {rule.channels.includes('email') && <Mail className="h-3 w-3" />}
            {rule.channels.includes('webhook') && <Webhook className="h-3 w-3" />}
            {rule.channels.join(', ')}
          </div>
          {rule.last_fired_at && (
            <span className="text-[10px] text-white">
              Last fired {formatRelativeTime(rule.last_fired_at)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          size="sm"
          variant={rule.is_active ? 'outline' : 'ghost'}
          onClick={() => onToggle(rule.id)}
        >
          {rule.is_active ? 'Pause' : 'Enable'}
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onDelete(rule.id)}>
          <Trash2 className="h-3.5 w-3.5 text-red-400" />
        </Button>
      </div>
    </div>
  )
}

// ─── Create rule form ─────────────────────────────────────────────────────────

function CreateRuleForm({
  brands,
  onCreated,
}: {
  brands: Brand[]
  onCreated: (rule: AlertRule) => void
}) {
  const [form, setForm] = useState({
    brand_id: '',
    name: '',
    type: 'mention_new' as AlertType,
    channels: ['email'] as string[],
    email: '',
    threshold: '',
    competitor: '',
  })
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!form.brand_id || !form.name || !form.email) {
      toast.error('Fill in brand, rule name, and email')
      return
    }
    setCreating(true)
    try {
      const condition: Record<string, unknown> = {}
      if (form.threshold) condition['threshold'] = parseFloat(form.threshold)
      if (form.competitor) condition['competitor'] = form.competitor

      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: form.brand_id,
          name: form.name,
          type: form.type,
          condition,
          channels: form.channels,
          email: form.email || null,
        }),
      })
      const json = (await res.json()) as { success: boolean; data?: AlertRule; message?: string }
      if (!json.success) throw new Error(json.message)
      onCreated(json.data!)
      toast.success('Alert rule created')
      setForm({
        brand_id: '',
        name: '',
        type: 'mention_new',
        channels: ['email'],
        email: '',
        threshold: '',
        competitor: '',
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create rule')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card className="animate-in border-brand-500/20 p-6">
      <h2 className="mb-5 flex items-center gap-2 text-base font-bold text-white">
        <Plus className="h-4 w-4 text-brand-400" /> New Alert Rule
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Brand *
          </label>
          <select
            className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            value={form.brand_id}
            onChange={(e) => setForm((f) => ({ ...f, brand_id: e.target.value }))}
          >
            <option value="">Select brand...</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Rule Name *
          </label>
          <input
            className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder-surface-500 outline-none focus:border-primary"
            placeholder="e.g. New mention alert"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Alert Type *
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ALERT_TYPES.map((t) => (
              <button
                key={t.type}
                className={cn(
                  'rounded-xl border p-3 text-left transition-all',
                  form.type === t.type
                    ? 'border-brand-500/50 bg-primary/10'
                    : 'border-border bg-surface-900/40 hover:border-border',
                )}
                onClick={() => setForm((f) => ({ ...f, type: t.type }))}
              >
                <t.icon className={cn('mb-1.5 h-4 w-4', `text-${t.color}-400`)} />
                <p className="text-[11px] font-bold text-white">{t.label}</p>
                <p className="text-[10px] leading-tight text-muted-foreground">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {form.type === 'competitor_ahead' && (
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Competitor Name
            </label>
            <input
              className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder-surface-500 outline-none focus:border-primary"
              placeholder="e.g. GetCito"
              value={form.competitor}
              onChange={(e) => setForm((f) => ({ ...f, competitor: e.target.value }))}
            />
          </div>
        )}

        {['sentiment_drop', 'visibility_change', 'citation_rate_change'].includes(form.type) && (
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Threshold{' '}
              {form.type === 'sentiment_drop'
                ? '(0-1, e.g. 0.3)'
                : '(score points, e.g. 10 for 10%)'}
            </label>
            <input
              className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder-surface-500 outline-none focus:border-primary"
              placeholder={form.type === 'sentiment_drop' ? '0.3' : '10'}
              type="number"
              value={form.threshold}
              onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
            />
          </div>
        )}

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Email *
          </label>
          <input
            className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder-surface-500 outline-none focus:border-primary"
            placeholder="alerts@yourdomain.com"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-3 border-t border-border pt-4">
        <Button loading={creating} onClick={handleCreate}>
          <Bell className="h-4 w-4" /> Create Alert Rule
        </Button>
      </div>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [rules, setRules] = useState<AlertRule[]>([])
  const [events, setEvents] = useState<AlertEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [tab, setTab] = useState<'events' | 'rules'>('events')

  const unreadCount = events.filter((e) => !e.is_read).length

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [brandsRes, rulesRes, eventsRes] = await Promise.all([
        fetch('/api/brands'),
        fetch('/api/alerts'),
        fetch('/api/alerts?type=events'),
      ])
      const bJson = (await brandsRes.json()) as { data?: Brand[] }
      const rJson = (await rulesRes.json()) as { data?: AlertRule[] }
      const eJson = (await eventsRes.json()) as { data?: AlertEvent[] }
      setBrands(bJson.data ?? [])
      setRules(rJson.data ?? [])
      setEvents(eJson.data ?? [])
    } catch {
      toast.error('Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleMarkRead = async (id: string) => {
    await fetch(`/api/alerts?id=${id}&action=read`, { method: 'PUT' })
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, is_read: true } : e)))
  }

  const handleDeleteEvent = async (id: string) => {
    await fetch(`/api/alerts?id=${id}&type=event`, { method: 'DELETE' })
    setEvents((prev) => prev.filter((e) => e.id !== id))
    toast.success('Event deleted')
  }

  const handleToggleRule = async (id: string) => {
    const res = await fetch(`/api/alerts?id=${id}&action=toggle`, { method: 'PUT' })
    const json = (await res.json()) as { success: boolean; data?: AlertRule }
    if (json.success && json.data) {
      setRules((prev) => prev.map((r) => (r.id === id ? json.data! : r)))
    }
  }

  const handleDeleteRule = async (id: string) => {
    await fetch(`/api/alerts?id=${id}&type=rule`, { method: 'DELETE' })
    setRules((prev) => prev.filter((r) => r.id !== id))
    toast.success('Rule deleted')
  }

  const markAllRead = async () => {
    await Promise.all(events.filter((e) => !e.is_read).map((e) => handleMarkRead(e.id)))
  }

  return (
    <div className="animate-in space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Alerts</h1>
          <p className="mt-1 text-muted-foreground">
            Real-time notifications when your brand visibility changes.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-5 w-5" /> New Rule
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Active Rules',
            value: rules.filter((r) => r.is_active).length,
            color: 'text-emerald-400',
          },
          { label: 'Unread Events', value: unreadCount, color: 'text-brand-400' },
          { label: 'Total Events', value: events.length, color: 'text-muted-foreground' },
        ].map((s) => (
          <Card key={s.label} className="p-5 text-center">
            <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {showForm && (
        <CreateRuleForm
          brands={brands}
          onCreated={(rule) => {
            setRules((prev) => [rule, ...prev])
            setShowForm(false)
          }}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-0">
        {[
          { id: 'events', label: `Events${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
          { id: 'rules', label: `Rules (${rules.length})` },
        ].map((t) => (
          <button
            key={t.id}
            className={cn(
              'border-b-2 px-4 pb-3 text-sm font-bold transition-colors',
              tab === t.id
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-muted-foreground hover:text-muted-foreground',
            )}
            onClick={() => setTab(t.id as typeof tab)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        </div>
      ) : tab === 'events' ? (
        <div className="space-y-3">
          {events.length > 0 && unreadCount > 0 && (
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={markAllRead}>
                <CheckCircle2 className="h-4 w-4" /> Mark all read
              </Button>
            </div>
          )}
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Bell className="200 mb-4 h-16 w-16 text-muted-foreground" />
              <h2 className="mb-2 text-xl font-bold text-white">No events yet</h2>
              <p className="text-muted-foreground">
                Alert events will appear here when your monitoring rules trigger.
              </p>
            </div>
          ) : (
            events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onDelete={handleDeleteEvent}
                onMarkRead={handleMarkRead}
              />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Bell className="mb-4 h-16 w-16 text-muted-foreground" />
              <h2 className="mb-2 text-xl font-bold text-white">No alert rules</h2>
              <p className="mb-6 text-muted-foreground">
                Create a rule to get notified when brand metrics change.
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" /> Create first rule
              </Button>
            </div>
          ) : (
            rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onDelete={handleDeleteRule}
                onToggle={handleToggleRule}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
