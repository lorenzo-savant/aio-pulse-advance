'use client'

/**
 * Asks /api/answers why a number is what it is, and shows the answer with the
 * rows behind it.
 *
 * Deliberately not a chat box. The questions offered are derived from this
 * brand's own data — the pillars that are actually weakest, and the delta only
 * when there is history to compare — so the panel can only ask things the data
 * can answer. That is also the cheapest honest test of whether a conversation
 * is needed at all: if nobody ever wants more than these, it was not.
 *
 * A refusal is rendered as an answer, not an error. "The data does not show
 * this" is the correct response to a question the rows cannot support, and
 * showing it plainly is what keeps the panel trustworthy.
 */
import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { HelpCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { suggestQuestions, type SuggestedQuestion } from '@/lib/agents/answer-questions'
import { cn } from '@/lib/utils'

interface Provenance {
  table: string
  detail: string
  rowCount: number
}

interface AnswerState {
  answer?: string
  facts?: string[]
  provenance?: Provenance[]
  /** Refusal code from the API, rendered from the catalog. */
  refusal?: string
  /** Client-side failure, kept apart from a refusal: one is data, one is a fault. */
  failed?: boolean
}

export function GroundedAnswerPanel({
  brandId,
  pillars,
  days,
  hasHistory,
}: {
  brandId: string
  pillars: Array<{ key: string; score: number }>
  days: number
  /** Whether more than one snapshot exists — the delta question needs two. */
  hasHistory: boolean
}) {
  const t = useTranslations('grounded_answers')
  const tg = useTranslations('geo_dashboard')
  const locale = useLocale()

  const [asked, setAsked] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [state, setState] = useState<AnswerState | null>(null)
  const [showFacts, setShowFacts] = useState(false)

  const questions = suggestQuestions(pillars, hasHistory)
  if (questions.length === 0) return null

  const labelFor = (q: SuggestedQuestion) =>
    q.kind === 'delta'
      ? t('ask_delta')
      : t('ask_pillar', {
          pillar: tg(`pillar_${q.pillar}`),
          score: (q.score ?? 0).toFixed(0),
        })

  async function ask(question: SuggestedQuestion) {
    setAsked(question.id)
    setLoading(true)
    setState(null)
    setShowFacts(false)

    try {
      const res = await fetch('/api/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          kind: question.kind,
          ...(question.pillar ? { pillar: question.pillar } : {}),
          days,
          locale,
        }),
      })
      const data = await res.json()

      if (res.status === 402) {
        setState({ refusal: 'budget_exhausted' })
      } else if (!res.ok) {
        setState({ failed: true })
      } else if (data.grounded === false) {
        setState({ refusal: `refusal_${data.reason}` })
      } else {
        setState({ answer: data.answer, facts: data.facts, provenance: data.provenance })
      }
    } catch {
      setState({ failed: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="mb-1 flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">{t('title')}</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t('subtitle')}</p>

      <div className="flex flex-wrap gap-2">
        {questions.map((q) => (
          <button
            key={q.id}
            onClick={() => ask(q)}
            disabled={loading}
            className={cn(
              'rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50',
              asked === q.id
                ? 'bg-primary/10 border-primary text-primary'
                : 'border-border bg-secondary text-foreground hover:border-primary',
            )}
          >
            {labelFor(q)}
          </button>
        ))}
      </div>

      {loading && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('thinking')}
        </p>
      )}

      {state && !loading && (
        <div className="mt-4 space-y-3">
          {state.failed && <p className="text-sm text-muted-foreground">{t('failed')}</p>}

          {/* A refusal reads the same as an answer on purpose: it is one. */}
          {state.refusal && (
            <p className="text-text-secondary-ui text-sm leading-relaxed">{t(state.refusal)}</p>
          )}

          {state.answer && (
            <>
              <p className="text-text-secondary-ui text-sm leading-relaxed">{state.answer}</p>

              {state.provenance && state.provenance.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {t('sources')}
                  </p>
                  {state.provenance.map((p) => (
                    <p key={p.table} className="font-mono text-[11px] text-muted-foreground">
                      {t('source_rows', {
                        table: p.table,
                        detail: p.detail,
                        count: p.rowCount,
                      })}
                    </p>
                  ))}
                </div>
              )}

              {/* The raw figures are what make the answer checkable rather than
                  merely believable, so they are one click away. */}
              {state.facts && state.facts.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowFacts((v) => !v)}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {showFacts ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                    {showFacts ? t('hide_figures') : t('show_figures')}
                  </button>
                  {showFacts && (
                    <ul className="mt-2 space-y-1">
                      {state.facts.map((fact, i) => (
                        <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                          <span>{fact}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  )
}
