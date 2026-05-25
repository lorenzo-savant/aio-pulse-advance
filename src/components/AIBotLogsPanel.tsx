'use client'

// AI bot crawl log analyzer — operator pastes a raw access log (Apache
// Combined, Nginx default, or CSV with a user_agent column) and we
// surface which LLM bots actually crawl their site, on which pages, and
// with what error rate. Pure client-side parse — no upload, no fetch,
// no logging. Implements the operator-side of the Semrush "track
// ChatGPT traffic" piece: referrer filters cover human clicks, this
// covers bot fetches.

import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Bot, Upload, ChevronDown, ChevronUp } from 'lucide-react'
import { analyzeLogs, type BotSummary } from '@/lib/utils/ai-bot-logs'

const PURPOSE_LABEL: Record<BotSummary['bot']['purpose'], string> = {
  index: 'Indexing',
  on_demand: 'On-demand fetch',
  training: 'Training crawl',
  preview: 'Link preview',
}

const PURPOSE_TONE: Record<BotSummary['bot']['purpose'], string> = {
  index: 'bg-sky-500/15 text-sky-300',
  on_demand: 'bg-emerald-500/15 text-emerald-300',
  training: 'bg-violet-500/15 text-violet-300',
  preview: 'bg-muted/60 text-foreground',
}

export function AIBotLogsPanel() {
  const [raw, setRaw] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const analysis = useMemo(() => (raw.trim() ? analyzeLogs(raw) : null), [raw])

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <Card className="p-6">
      <div className="mb-2 flex items-center gap-2">
        <Bot className="h-4 w-4 text-brand" />
        <h2 className="text-lg font-bold text-foreground">AI bot crawl log analyzer</h2>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Paste a raw access log (Apache/Nginx Combined or CSV with a <code>user_agent</code> column)
        to see which LLM crawlers are actually fetching your pages. Parsed entirely in the browser —
        nothing is uploaded.
      </p>

      <div className="mb-3 rounded-lg border border-input">
        <div className="bg-input/30 flex items-center justify-between border-b border-input px-3 py-1.5">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Upload className="h-3 w-3" />
            Paste log lines below
          </span>
          {raw && (
            <button
              onClick={() => setRaw('')}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={`192.168.1.1 - - [25/May/2026:13:42:11 +0000] "GET /pricing HTTP/1.1" 200 1234 "-" "PerplexityBot/1.0"\n\n…or CSV with header row:\ntimestamp,path,status,user_agent`}
          className="h-48 w-full resize-y rounded-b-lg bg-background px-3 py-2 font-mono text-[11px] text-foreground focus:outline-none"
          spellCheck={false}
        />
      </div>

      {analysis && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="bg-input/30 rounded-md border border-input p-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Lines parsed
              </p>
              <p className="mt-0.5 text-xl font-black text-foreground">{analysis.totalLines}</p>
            </div>
            <div className="bg-input/30 rounded-md border border-input p-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                AI bot hits
              </p>
              <p className="mt-0.5 text-xl font-black text-brand">{analysis.totalBotHits}</p>
            </div>
            <div className="bg-input/30 rounded-md border border-input p-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Distinct AI bots
              </p>
              <p className="mt-0.5 text-xl font-black text-foreground">{analysis.perBot.length}</p>
            </div>
            <div className="bg-input/30 rounded-md border border-input p-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Non-AI agents
              </p>
              <p className="mt-0.5 text-xl font-black text-muted-foreground">
                {analysis.unknownAgents}
              </p>
            </div>
          </div>

          {analysis.perBot.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No known AI bot UA matched in this log block.{' '}
              {analysis.totalLines === 0 && '(Could not parse any log line — check the format.)'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {analysis.perBot.map((b) => {
                const open = expanded.has(b.bot.name)
                return (
                  <div key={b.bot.name} className="bg-input/30 rounded-md border border-input">
                    <button
                      onClick={() => toggle(b.bot.name)}
                      className="hover:bg-input/50 flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="font-bold text-foreground">{b.bot.name}</span>
                        <span className="text-xs text-muted-foreground">{b.bot.owner}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${PURPOSE_TONE[b.bot.purpose]}`}
                        >
                          {PURPOSE_LABEL[b.bot.purpose]}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-xs">
                        <span className="font-bold text-foreground">{b.hits} hits</span>
                        <span className="text-muted-foreground">{b.uniquePaths} paths</span>
                        {b.errorRate > 0 && (
                          <span className="text-rose-300">{b.errorRate}% errors</span>
                        )}
                        {open ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </div>
                    </button>
                    {open && (
                      <div className="border-t border-input px-3 py-2">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Top paths
                        </p>
                        <ul className="space-y-0.5">
                          {b.topPaths.map((p) => (
                            <li
                              key={p.path}
                              className="flex items-center justify-between gap-2 font-mono text-[11px]"
                            >
                              <span className="truncate text-foreground" title={p.path}>
                                {p.path}
                              </span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">
                                {p.hits}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {analysis.topPaths.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Most-crawled paths across all AI bots
              </p>
              <ul className="space-y-0.5">
                {analysis.topPaths.slice(0, 8).map((p) => (
                  <li
                    key={p.path}
                    className="bg-input/30 flex items-center justify-between gap-2 rounded border border-input px-2 py-1 font-mono text-[11px]"
                  >
                    <span className="truncate text-foreground" title={p.path}>
                      {p.path}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {p.bots.join(' · ')}
                      </span>
                      <span className="font-bold tabular-nums text-foreground">{p.hits}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
