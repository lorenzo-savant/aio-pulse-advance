'use client'

// AI Referral Filter Generator — copy-paste-ready segment expressions
// for the most common analytics tools (GA4, Plausible, Matomo, Looker
// Studio, Cloudflare Logs). Closes the gap from the industry research "track
// ChatGPT traffic" piece: operators want a single source of truth for
// the host list so they don't miss new engines as they appear.
//
// Pure UI — no backend, no fetch. The list is in one place so adding
// a new AI engine to track means editing one constant.

import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Copy, Check, Compass } from 'lucide-react'

interface ReferrerHost {
  host: string
  label: string
}

// Source: aggregated from the major LLM consumer surfaces that send
// referrer headers. CCBot/GPTBot/etc. are bot UAs (see AIBotLogsPanel),
// NOT referrers — keep them separate.
const AI_REFERRER_HOSTS: ReferrerHost[] = [
  { host: 'chat.openai.com', label: 'ChatGPT (legacy)' },
  { host: 'chatgpt.com', label: 'ChatGPT' },
  { host: 'perplexity.ai', label: 'Perplexity' },
  { host: 'www.perplexity.ai', label: 'Perplexity (www)' },
  { host: 'gemini.google.com', label: 'Gemini' },
  { host: 'bard.google.com', label: 'Bard (legacy)' },
  { host: 'claude.ai', label: 'Claude' },
  { host: 'copilot.microsoft.com', label: 'Copilot' },
  { host: 'bing.com', label: 'Bing (Copilot in SERP)' },
  { host: 'duckduckgo.com', label: 'DuckDuckGo (AI Chat)' },
  { host: 'you.com', label: 'You.com' },
  { host: 'phind.com', label: 'Phind' },
  { host: 'mistral.ai', label: 'Mistral le Chat' },
  { host: 'kagi.com', label: 'Kagi Assistant' },
]

type Tool = 'ga4_regex' | 'plausible' | 'matomo' | 'looker_studio' | 'cf_logs' | 'js'

const TOOLS: Array<{ key: Tool; label: string; hint: string }> = [
  {
    key: 'ga4_regex',
    label: 'GA4 / Universal Analytics regex',
    hint: 'Paste into a regex audience or "Page referrer matches regex" segment.',
  },
  {
    key: 'plausible',
    label: 'Plausible "source contains"',
    hint: 'Plausible filters take one host at a time — listed comma-separated for convenience.',
  },
  {
    key: 'matomo',
    label: 'Matomo referrer URL contains',
    hint: 'Pipe-separated list for the Referrer URL filter.',
  },
  {
    key: 'looker_studio',
    label: 'Looker Studio REGEXP_MATCH',
    hint: 'Drop into a calculated field: REGEXP_MATCH(Source / Medium, …)',
  },
  {
    key: 'cf_logs',
    label: 'Cloudflare Logpush (LogQL-style)',
    hint: 'For querying Cloudflare logs / Workers / R2 archives.',
  },
  {
    key: 'js',
    label: 'Inline JS / GTM trigger',
    hint: 'Returns true if the current document.referrer matches an AI engine.',
  },
]

function buildExpression(tool: Tool, hosts: string[]): string {
  const escaped = hosts.map((h) => h.replace(/\./g, '\\.'))
  const literal = hosts.join('|')
  switch (tool) {
    case 'ga4_regex':
      return `^https?://([^/]+\\.)?(${escaped.join('|')})/`
    case 'plausible':
      return hosts.join(',')
    case 'matomo':
      return literal
    case 'looker_studio':
      return `REGEXP_MATCH(Source, "(${literal})")`
    case 'cf_logs':
      return `ClientRequestReferer matches "(${escaped.join('|')})"`
    case 'js':
      return `/(${escaped.join('|')})/i.test(document.referrer)`
  }
}

export function AIReferralFiltersPanel() {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(AI_REFERRER_HOSTS.map((h) => h.host)),
  )
  const [copied, setCopied] = useState<Tool | null>(null)

  const hosts = useMemo(
    () => AI_REFERRER_HOSTS.filter((h) => selected.has(h.host)).map((h) => h.host),
    [selected],
  )

  function toggle(host: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(host)) next.delete(host)
      else next.add(host)
      return next
    })
  }

  async function copy(tool: Tool) {
    const expr = buildExpression(tool, hosts)
    try {
      await navigator.clipboard.writeText(expr)
      setCopied(tool)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* noop */
    }
  }

  return (
    <Card className="p-6">
      <div className="mb-2 flex items-center gap-2">
        <Compass className="h-4 w-4 text-brand" />
        <h2 className="text-lg font-bold text-foreground">AI referral filter generator</h2>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Paste-ready segment/regex expressions to spot AI traffic in your existing analytics. Toggle
        engines on/off — the expressions update live.
      </p>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {AI_REFERRER_HOSTS.map((h) => {
          const active = selected.has(h.host)
          return (
            <button
              key={h.host}
              onClick={() => toggle(h.host)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                active
                  ? 'bg-brand/10 border-brand text-brand'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
              title={h.host}
            >
              {h.label}
            </button>
          )
        })}
      </div>

      {hosts.length === 0 ? (
        <p className="text-xs text-muted-foreground">Select at least one engine.</p>
      ) : (
        <div className="space-y-3">
          {TOOLS.map((t) => {
            const expr = buildExpression(t.key, hosts)
            return (
              <div key={t.key} className="bg-input/30 rounded-lg border border-input p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-foreground">{t.label}</p>
                    <p className="text-[11px] text-muted-foreground">{t.hint}</p>
                  </div>
                  <button
                    onClick={() => copy(t.key)}
                    className="hover:bg-secondary/70 inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground transition-colors"
                  >
                    {copied === t.key ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-background px-2 py-1.5 text-[11px] text-foreground">
                  {expr}
                </pre>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
