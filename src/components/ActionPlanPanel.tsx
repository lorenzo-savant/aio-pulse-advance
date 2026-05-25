'use client'

// "Action plan" panel — turns a technical-SEO audit result into a
// prioritised Today / This week / This month list.
//
// Closes the gap from the Semrush "AI search optimization next steps":
//   "Today (30 minutes): Find 2-3 statistics for an article and add them.
//    This week: Rewrite 3-5 key headings as questions. Add one specific
//    statistic, result, or case study to your author bio…"
//
// Consumes the AuditResult shape produced by /api/audit/technical and
// renders the output of prioritizeAuditActions. Pure presentation —
// the logic lives in src/lib/utils/audit-action-plan.ts.

import { useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { CalendarCheck, Clock, CalendarDays, Calendar } from 'lucide-react'
import { prioritizeAuditActions } from '@/lib/utils/audit-action-plan'
import type { AuditResult } from '@/lib/services/technical-seo-audit'

// Accept either the service's strict AuditResult or any structurally-
// compatible value (the audit page declares its own local shape, but
// the underlying fields are the same).
interface Props {
  audit: AuditResult | (Omit<AuditResult, 'categories'> & { categories: AuditResult['categories'] })
}

const BUCKET_META = {
  today: {
    label: 'Today',
    icon: Clock,
    blurb: '~30 min each — quick header/meta/robots fixes.',
    accent: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/30',
  },
  thisWeek: {
    label: 'This week',
    icon: CalendarDays,
    blurb: 'Higher-impact rewrites — structure, schema, E-E-A-T.',
    accent: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
  },
  thisMonth: {
    label: 'This month',
    icon: Calendar,
    blurb: 'Longer effort items — security, deep content overhauls.',
    accent: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/30',
  },
} as const

type BucketKey = keyof typeof BUCKET_META

export function ActionPlanPanel({ audit }: Props) {
  const plan = useMemo(() => prioritizeAuditActions(audit), [audit])

  if (plan.totalActions === 0) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5 p-5 text-sm text-emerald-300">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4" />
          <span className="font-semibold text-foreground">Nothing to fix.</span>
          <span>This audit found no failing or warning checks — ship it.</span>
        </div>
      </Card>
    )
  }

  const buckets: BucketKey[] = ['today', 'thisWeek', 'thisMonth']

  return (
    <Card className="p-6">
      <div className="mb-2 flex items-center gap-2">
        <CalendarCheck className="h-4 w-4 text-brand" />
        <h2 className="text-lg font-bold text-foreground">Action Plan</h2>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        The {plan.totalActions} actionable findings from this audit, sorted by impact × ease. Quick
        wins go in <strong>Today</strong>; structural rewrites in <strong>This week</strong>;
        slow-burn items in <strong>This month</strong>.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {buckets.map((b) => {
          const items = plan[b]
          const meta = BUCKET_META[b]
          const Icon = meta.icon
          return (
            <div key={b} className={`rounded-lg border ${meta.bg} p-4`}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${meta.accent}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${meta.accent}`}>
                    {meta.label}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <p className="mb-3 text-[11px] text-muted-foreground">{meta.blurb}</p>

              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing in this bucket — nice.</p>
              ) : (
                <ol className="space-y-2">
                  {items.slice(0, 8).map((a) => (
                    <li key={a.id} className="bg-input/40 rounded-md border border-input px-3 py-2">
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{a.title}</p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {a.priorityScore}
                        </span>
                      </div>
                      <p className="text-[11px] leading-snug text-muted-foreground">{a.why}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        impact {a.impact} · ease {a.ease} · {a.category}
                      </p>
                    </li>
                  ))}
                  {items.length > 8 && (
                    <li className="text-center text-[11px] text-muted-foreground">
                      +{items.length - 8} more — see audit details
                    </li>
                  )}
                </ol>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
