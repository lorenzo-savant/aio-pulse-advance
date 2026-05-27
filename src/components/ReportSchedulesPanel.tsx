'use client'

// "Scheduled deliveries" panel for /dashboard/reports. Lets operators
// set up automatic email delivery of the white-label PDF report on a
// daily/weekly/monthly cadence, manage existing schedules, and see the
// last delivery status. See /api/brands/[id]/report-schedules for CRUD
// and /api/cron/report-delivery for the sweep that fires deliveries.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  Mail,
  Loader2,
  AlertTriangle,
  Plus,
  Trash2,
  CalendarClock,
  CheckCircle2,
  X,
} from 'lucide-react'

interface ReportSchedule {
  id: string
  brand_id: string
  frequency: 'daily' | 'weekly' | 'monthly'
  recipients: string[]
  label: string | null
  is_active: boolean
  next_run_at: string
  last_sent_at: string | null
  last_error: string | null
  send_count: number
  created_at: string
}

const FREQ_LABEL: Record<ReportSchedule['frequency'], string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

export function ReportSchedulesPanel({ brandId }: { brandId: string }) {
  const [schedules, setSchedules] = useState<ReportSchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [migrationPending, setMigrationPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formFreq, setFormFreq] = useState<ReportSchedule['frequency']>('weekly')
  const [formRecipients, setFormRecipients] = useState('')
  const [formLabel, setFormLabel] = useState('')

  async function reload() {
    if (!brandId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/brands/${brandId}/report-schedules`)
      const j = await res.json()
      if (!res.ok || !j.success) {
        if (j.code === 'SCHEDULES_MIGRATION_PENDING') {
          setMigrationPending(true)
          return
        }
        throw new Error(j.message || 'Failed to load schedules')
      }
      setMigrationPending(false)
      setSchedules(j.data as ReportSchedule[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load schedules')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId])

  async function create() {
    const recipients = formRecipients
      .split(/[\s,;]+/)
      .map((r) => r.trim())
      .filter(Boolean)
    if (recipients.length === 0) {
      setError('Add at least one recipient email')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/brands/${brandId}/report-schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frequency: formFreq,
          recipients,
          label: formLabel.trim() || undefined,
        }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) {
        if (j.code === 'SCHEDULES_MIGRATION_PENDING') {
          setMigrationPending(true)
          return
        }
        throw new Error(typeof j.message === 'string' ? j.message : 'Failed to create schedule')
      }
      setFormFreq('weekly')
      setFormRecipients('')
      setFormLabel('')
      setAdding(false)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create schedule')
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this scheduled delivery? Past sends are preserved in send history.'))
      return
    try {
      const res = await fetch(`/api/brands/${brandId}/report-schedules?schedule_id=${id}`, {
        method: 'DELETE',
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.message || 'Delete failed')
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  if (migrationPending) {
    return (
      <Card className="p-4 text-xs text-amber-300">
        <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
        Scheduled deliveries not yet enabled — apply migration{' '}
        <code className="rounded bg-amber-500/20 px-1">20260527000000_report_schedules.sql</code>.
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Scheduled deliveries</h2>
        </div>
        {!adding && (
          <Button onClick={() => setAdding(true)} size="sm">
            <Plus className="h-3.5 w-3.5" /> Add schedule
          </Button>
        )}
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Schedule automatic email delivery of the white-label PDF report to clients or internal
        stakeholders. The cron sweep picks up due schedules and sends via Resend with the PDF
        attached.
      </p>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {adding && (
        <div className="bg-input/30 mb-4 space-y-3 rounded-lg border border-input p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Frequency
              </label>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                value={formFreq}
                onChange={(e) => setFormFreq(e.target.value as ReportSchedule['frequency'])}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Label (optional)
              </label>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                placeholder='e.g. "Monthly client report"'
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                maxLength={120}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Recipients (comma, space, or newline separated)
            </label>
            <textarea
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              rows={2}
              placeholder="client@example.com, team@example.com"
              value={formRecipients}
              onChange={(e) => setFormRecipients(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setAdding(false)} variant="outline" size="sm">
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
            <Button onClick={create} disabled={submitting} size="sm">
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Create schedule
            </Button>
          </div>
        </div>
      )}

      {loading && schedules.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Loading schedules…
        </div>
      ) : schedules.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">
          No scheduled deliveries yet. Click <b>Add schedule</b> to send this brand&apos;s report on
          a recurring cadence.
        </p>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => (
            <div
              key={s.id}
              className="bg-input/30 flex flex-col gap-2 rounded-lg border border-input px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="bg-brand/15 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                    {FREQ_LABEL[s.frequency]}
                  </span>
                  {s.label && (
                    <span className="text-sm font-semibold text-foreground">{s.label}</span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  To: {s.recipients.join(', ')}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Next run: {new Date(s.next_run_at).toLocaleString()} · Sent {s.send_count} time
                  {s.send_count === 1 ? '' : 's'}
                  {s.last_sent_at && ` · last ${new Date(s.last_sent_at).toLocaleDateString()}`}
                </p>
                {s.last_error ? (
                  <p className="mt-0.5 text-[11px] text-rose-300">
                    <AlertTriangle className="mr-1 inline h-3 w-3" />
                    Last error: {s.last_error}
                  </p>
                ) : s.last_sent_at ? (
                  <p className="mt-0.5 text-[11px] text-emerald-300">
                    <CheckCircle2 className="mr-1 inline h-3 w-3" />
                    Last delivery succeeded
                  </p>
                ) : null}
              </div>
              <button
                onClick={() => remove(s.id)}
                className="shrink-0 text-muted-foreground hover:text-rose-400"
                title="Delete schedule"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
