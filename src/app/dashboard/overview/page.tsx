'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/Card'
import { SectionHelp } from '@/components/help/SectionHelp'
import { Badge } from '@/components/ui/index'
import { HorizonChart } from '@/components/ui/Chart'
import { PageTransition, StaggerGrid, StaggerItem } from '@/components/ui/Motion'
import { StrikingDistancePanel } from '@/components/StrikingDistancePanel'
import { useRealtime } from '@/lib/hooks/use-realtime'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Search,
  Globe,
  MessageSquare,
  RefreshCw,
  Download,
  Sparkles,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Circle,
  ShieldCheck,
} from 'lucide-react'

interface HealthMetric {
  name: string
  current: number
  previous: number
  change: number
  status: 'excellent' | 'good' | 'fair' | 'poor'
}

interface GscData {
  date: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface KeywordData {
  keyword: string
  searchVolume: number
  competition: number
  cpc: number
  intent: string
}

interface ScraperResult {
  keyword: string
  mentions: number
  aiOverviewCited: boolean
  sources: string[]
  scrapedAt: string
}

interface AiAgent {
  id: string
  name: string
  description: string
  icon: typeof Activity
  color: string
}

const AGENTS: AiAgent[] = [
  {
    id: 'brand_monitor',
    name: 'Brand Monitor',
    description: 'Real-time health analysis',
    icon: Activity,
    color: 'text-brand',
  },
  {
    id: 'competitor_analyst',
    name: 'Competitor Analyst',
    description: 'Competitive positioning',
    icon: Globe,
    color: 'text-purple-500',
  },
  {
    id: 'keyword_expert',
    name: 'Keyword Expert',
    description: 'Search volume & intent',
    icon: Search,
    color: 'text-green-500',
  },
  {
    id: 'report_builder',
    name: 'Report Builder',
    description: 'Generate reports',
    icon: Download,
    color: 'text-orange-500',
  },
  {
    id: 'audit_expert',
    name: 'Audit Expert',
    description: 'SEO/AEO/E-E-A-T audits',
    icon: ShieldCheck,
    color: 'text-red-500',
  },
]

export default function BrandOverviewPage() {
  const t = useTranslations('brand_overview')
  const tGsc = useTranslations('gsc')
  const tScraper = useTranslations('scraper')
  const tKeywords = useTranslations('keyword_research')
  const tAgents = useTranslations('ai_agents')

  const [selectedBrand, setSelectedBrand] = useState('')
  const [period, setPeriod] = useState('30d')
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([])
  const [gscTrend, setGscTrend] = useState<GscData[]>([])
  const [keywords, setKeywords] = useState<KeywordData[]>([])
  const [scraperResults, setScraperResults] = useState<ScraperResult[]>([])

  const [selectedAgent, setSelectedAgent] = useState('brand_monitor')
  const [aiMessage, setAiMessage] = useState('')
  const [aiResponses, setAiResponses] = useState<
    Array<{ role: string; content: string; agentName?: string; provider?: string }>
  >([])
  const [aiLoading, setAiLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [colleaguesOnline] = useState(3)
  const [liveIndicator, setLiveIndicator] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(async () => {
    setRefreshing(true)
    try {
      const [brandsRes, healthRes, gscRes, keywordsRes, scraperRes, agentsRes] = await Promise.all([
        fetch('/api/brands'),
        fetch(`/api/health-scores?brand_id=${selectedBrand}&period=${period}`),
        fetch(`/api/gsc?brand_id=${selectedBrand}&period=${period}`),
        fetch(`/api/keywords?brand_id=${selectedBrand}`),
        fetch(`/api/scraper?brand_id=${selectedBrand}`),
        fetch('/api/ai-agent'),
      ])

      const [bJson, hJson, gJson, kJson, sJson, agentsJson] = await Promise.all([
        brandsRes.json(),
        healthRes.json(),
        gscRes.json(),
        keywordsRes.json(),
        scraperRes.json(),
        agentsRes.json(),
      ])

      setBrands(bJson.data || [])
      setHealthMetrics(hJson.metrics || [])
      setGscTrend(gJson.trend || [])
      setKeywords(kJson.data || [])
      setScraperResults(sJson.results || [])
    } catch (err) {
      console.error('Failed to load overview data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedBrand, period])

  useEffect(() => {
    loadData()
  }, [loadData])

  const { isConnected } = useRealtime({
    enabled: true,
    onHealthScoreUpdate: () => {
      setLiveIndicator(true)
      setTimeout(() => setLiveIndicator(false), 2000)
      loadData()
    },
    onGscUpdate: () => loadData(),
    onKeywordUpdate: () => loadData(),
    onScraperUpdate: () => loadData(),
  })

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiResponses])

  const handleAiSubmit = async () => {
    if (!aiMessage.trim()) return

    const userMessage = aiMessage
    setAiMessage('')
    setAiResponses((prev) => [...prev, { role: 'user', content: userMessage }])
    setAiLoading(true)

    try {
      const agent = AGENTS.find((a) => a.id === selectedAgent)

      const res = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          agentId: selectedAgent,
          brandId: selectedBrand,
          conversationId,
          context: {
            healthMetrics,
            gscTrend,
            keywords,
            scraperResults,
          },
        }),
      })

      const data = await res.json()

      if (res.ok) {
        if (!conversationId && data.conversationId) {
          setConversationId(data.conversationId)
        }

        setAiResponses((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.response,
            agentName: data.agentName,
            provider: data.provider,
          },
        ])
      } else {
        setAiResponses((prev) => [
          ...prev,
          { role: 'assistant', content: data.error || tAgents('error') },
        ])
      }
    } catch (err) {
      setAiResponses((prev) => [...prev, { role: 'assistant', content: tAgents('error') }])
    } finally {
      setAiLoading(false)
    }
  }

  const getStatusIcon = (status: HealthMetric['status']) => {
    switch (status) {
      case 'excellent':
        return <TrendingUp className="h-4 w-4 text-success" />
      case 'good':
        return <ArrowUpRight className="h-4 w-4 text-brand" />
      case 'fair':
        return <Minus className="h-4 w-4 text-warning" />
      case 'poor':
        return <ArrowDownRight className="h-4 w-4 text-error" />
    }
  }

  const getStatusBadge = (status: HealthMetric['status']) => {
    const variant =
      status === 'excellent'
        ? 'success'
        : status === 'good'
          ? 'default'
          : status === 'fair'
            ? 'warning'
            : 'danger'
    return <Badge variant={variant}>{t(`score_table.${status}`)}</Badge>
  }

  const getIntentBadge = (intent: string) => {
    const colors: Record<string, string> = {
      informational: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      transactional: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      commercial: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      navigational: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    }
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs ${colors[intent] || ''}`}>
        {tKeywords(`intents.${intent}`)}
      </span>
    )
  }

  const gscChartSeries = [
    { name: tGsc('clicks'), data: gscTrend.map((d) => d.clicks) },
    { name: tGsc('impressions'), data: gscTrend.map((d) => d.impressions) },
  ]
  const gscCategories = gscTrend.map((d) => d.date)

  const visibilitySeries = [{ name: t('visibility'), data: healthMetrics.map((m) => m.current) }]
  const visibilityCategories = healthMetrics.map((m) => m.name)

  if (loading) {
    return (
      <PageTransition>
        <div className="flex h-[60vh] items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-brand" />
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <SectionHelp section="overview" />
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Pages / Dashboard / {t('title')}
            </p>
            <h1 className="mt-1 text-[34px] font-bold tracking-tight text-foreground">
              {t('title')}
            </h1>
            <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              className="rounded-xl border border-border bg-input px-4 py-2 text-sm text-foreground"
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
            >
              <option value="">Select brand</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <div className="flex rounded-xl border border-border bg-input p-1">
              {(['7d', '30d', '60d', '90d'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    period === p
                      ? 'bg-brand text-white'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t(`period.${p}`)}
                </button>
              ))}
            </div>

            <button
              onClick={loadData}
              className="hover:bg-brand/90 flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Live Status Bar */}
        <div className="bg-secondary/50 flex items-center gap-4 rounded-xl border border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Circle
              className={`h-3 w-3 ${isConnected ? 'fill-success text-success' : 'fill-muted-foreground text-muted-foreground'}`}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {isConnected ? 'Realtime Connected' : 'Realtime Disconnected'}
            </span>
          </div>
          {liveIndicator && (
            <div className="flex items-center gap-1 text-success">
              <Zap className="h-3 w-3" />
              <span className="text-xs font-medium">Live update received</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              {colleaguesOnline} {tAgents('colleagues_online')}
            </span>
            <Badge variant="success" className="ml-1">
              {tAgents('real_time')}
            </Badge>
          </div>
        </div>

        {/* Health Score Cards */}
        <StaggerGrid className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
          {healthMetrics.map((metric) => (
            <StaggerItem key={metric.name}>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{metric.name}</p>
                  {getStatusIcon(metric.status)}
                </div>
                <p className="mt-2 text-2xl font-bold">{metric.current.toFixed(1)}</p>
                <div className="mt-1 flex items-center gap-1">
                  {metric.change > 0 ? (
                    <TrendingUp className="h-3 w-3 text-success" />
                  ) : metric.change < 0 ? (
                    <TrendingDown className="h-3 w-3 text-error" />
                  ) : (
                    <Minus className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span
                    className={`text-xs ${metric.change > 0 ? 'text-success' : metric.change < 0 ? 'text-error' : 'text-muted-foreground'}`}
                  >
                    {metric.change > 0 ? '+' : ''}
                    {metric.change.toFixed(1)}%
                  </span>
                </div>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGrid>

        {/* Score Table */}
        <Card className="overflow-hidden">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold">{t('score_table.title')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="px-6 py-3 text-left font-medium">{t('score_table.metric')}</th>
                  <th className="px-6 py-3 text-left font-medium">{t('score_table.current')}</th>
                  <th className="px-6 py-3 text-left font-medium">{t('score_table.previous')}</th>
                  <th className="px-6 py-3 text-left font-medium">{t('score_table.change')}</th>
                  <th className="px-6 py-3 text-left font-medium">{t('score_table.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {healthMetrics.map((metric) => (
                  <tr key={metric.name} className="hover:bg-secondary/50">
                    <td className="px-6 py-4 font-medium">{metric.name}</td>
                    <td className="px-6 py-4">{metric.current.toFixed(1)}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {metric.previous.toFixed(1)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={
                          metric.change > 0
                            ? 'text-success'
                            : metric.change < 0
                              ? 'text-error'
                              : 'text-muted-foreground'
                        }
                      >
                        {metric.change > 0 ? '+' : ''}
                        {metric.change.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(metric.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">{tGsc('daily_trend')}</h2>
            </div>
            <div className="p-6">
              {gscTrend.length > 0 ? (
                <HorizonChart
                  variant="area"
                  series={gscChartSeries}
                  categories={gscCategories}
                  height={300}
                />
              ) : (
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  {tGsc('not_configured')}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">{t('visibility')}</h2>
            </div>
            <div className="p-6">
              <HorizonChart
                variant="bar"
                series={visibilitySeries}
                categories={visibilityCategories}
                height={300}
              />
            </div>
          </Card>
        </div>

        {/* Keywords & Scraper Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">{tKeywords('title')}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary">
                    <th className="px-4 py-3 text-left font-medium">{tKeywords('title')}</th>
                    <th className="px-4 py-3 text-left font-medium">
                      {tKeywords('search_volume')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">{tKeywords('competition')}</th>
                    <th className="px-4 py-3 text-left font-medium">{tKeywords('cpc')}</th>
                    <th className="px-4 py-3 text-left font-medium">{tKeywords('intent')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {keywords.slice(0, 10).map((kw) => (
                    <tr key={kw.keyword} className="hover:bg-secondary/50">
                      <td className="px-4 py-3 font-medium">{kw.keyword}</td>
                      <td className="px-4 py-3">{kw.searchVolume.toLocaleString()}</td>
                      <td className="px-4 py-3">{(kw.competition * 100).toFixed(0)}%</td>
                      <td className="px-4 py-3">${kw.cpc.toFixed(2)}</td>
                      <td className="px-4 py-3">{getIntentBadge(kw.intent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">{tScraper('results')}</h2>
            </div>
            <div className="divide-y divide-border">
              {scraperResults.slice(0, 5).map((result, i) => (
                <div key={i} className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{result.keyword}</p>
                    <Badge variant={result.aiOverviewCited ? 'success' : 'default'}>
                      {result.aiOverviewCited ? 'AI Cited' : 'Not Cited'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {result.mentions} mentions • {result.sources.length} sources
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(result.scrapedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <StrikingDistancePanel />

        {/* AI Agent Chat with Team Collaboration */}
        <Card>
          <div className="border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{tAgents('title')}</h2>
                <p className="text-sm text-muted-foreground">{tAgents('subtitle')}</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Agent Selection */}
            <div className="mb-4 flex gap-2 overflow-x-auto">
              {AGENTS.map(({ id, name, description, icon: Icon, color }) => (
                <button
                  key={id}
                  onClick={() => setSelectedAgent(id)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all ${
                    selectedAgent === id
                      ? 'bg-brand/5 border-brand text-brand'
                      : 'border-border hover:bg-secondary'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${color}`} />
                  <div className="text-left">
                    <p className="font-medium">{name}</p>
                    <p className="text-[10px] text-muted-foreground">{description}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Chat Messages */}
            <div className="bg-secondary/30 mb-4 max-h-[400px] space-y-4 overflow-y-auto rounded-xl border border-border p-4">
              {aiResponses.length === 0 && (
                <div className="text-center text-muted-foreground">
                  <Sparkles className="text-muted-foreground/50 mx-auto mb-2 h-8 w-8" />
                  <p className="text-sm">{tAgents('subtitle')}</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {(tAgents.raw('suggestions') as string[]).map(
                      (suggestion: string, i: number) => (
                        <button
                          key={i}
                          onClick={() => setAiMessage(suggestion)}
                          className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          {suggestion}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}

              {aiResponses.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] space-y-1`}>
                    {msg.role === 'assistant' && msg.agentName && (
                      <p className="text-[10px] text-muted-foreground">
                        {msg.agentName} • {msg.provider}
                      </p>
                    )}
                    <div
                      className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${
                        msg.role === 'user' ? 'bg-brand text-white' : 'bg-input text-foreground'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}

              {aiLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-input px-4 py-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {tAgents('typing')}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={aiMessage}
                onChange={(e) => setAiMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAiSubmit()}
                placeholder={tAgents('placeholder')}
                className="flex-1 rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none"
              />
              <button
                onClick={handleAiSubmit}
                disabled={!aiMessage.trim() || aiLoading}
                className="hover:bg-brand/90 flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                <MessageSquare className="h-4 w-4" />
                {tAgents('send')}
              </button>
            </div>
          </div>
        </Card>
      </div>
    </PageTransition>
  )
}
