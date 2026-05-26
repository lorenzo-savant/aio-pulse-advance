import type { AIProviderId } from '@/lib/providers/types'
import type { Brand } from '@/types'

export interface AgentContext {
  brand?: Brand | null
  healthMetrics?: Array<{ name: string; current: number; previous: number; change: number }>
  gscTrend?: Array<{
    date: string
    clicks: number
    impressions: number
    ctr: number
    position: number
  }>
  keywords?: Array<{
    keyword: string
    searchVolume: number
    competition: number
    cpc: number
    intent: string
  }>
  scraperResults?: Array<{
    keyword: string
    mentions: number
    aiOverviewCited: boolean
    sources: string[]
  }>
  competitorData?: Array<{ name: string; visibility: number; mentions: number }>
  conversationHistory?: Array<{ role: string; content: string }>
}

export interface AgentResponse {
  success: boolean
  content: string
  provider: AIProviderId
  latencyMs?: number
  tokensUsed?: number
  costEstimate?: number
}

export abstract class BaseAgent {
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly description: string
  abstract readonly optimalProvider: AIProviderId
  abstract readonly systemPrompt: string

  protected buildPrompt(userMessage: string, context: AgentContext): string {
    const contextParts: string[] = []

    if (context.brand) {
      contextParts.push(`Brand: ${context.brand.name}`)
      if (context.brand.domain) contextParts.push(`Domain: ${context.brand.domain}`)
      if (context.brand.industry) contextParts.push(`Industry: ${context.brand.industry}`)
    }

    if (context.healthMetrics?.length) {
      contextParts.push('\nHealth Metrics:')
      context.healthMetrics.forEach((m) => {
        contextParts.push(
          `- ${m.name}: ${m.current.toFixed(1)} (change: ${m.change > 0 ? '+' : ''}${m.change.toFixed(1)}%)`,
        )
      })
    }

    if (context.gscTrend?.length) {
      const latest = context.gscTrend[context.gscTrend.length - 1]
      if (latest) {
        contextParts.push(
          `\nGSC Latest: ${latest.clicks} clicks, ${latest.impressions} impressions, CTR: ${(latest.ctr * 100).toFixed(1)}%, Position: ${latest.position.toFixed(1)}`,
        )
      }
    }

    if (context.keywords?.length) {
      contextParts.push('\nTop Keywords:')
      context.keywords.slice(0, 10).forEach((kw) => {
        contextParts.push(`- "${kw.keyword}": Volume ${kw.searchVolume}, ${kw.intent}`)
      })
    }

    if (context.scraperResults?.length) {
      const cited = context.scraperResults.filter((r) => r.aiOverviewCited).length
      contextParts.push(
        `\nScraper: ${context.scraperResults.length} results, ${cited} AI Overview citations`,
      )
    }

    if (context.competitorData?.length) {
      contextParts.push('\nCompetitors:')
      context.competitorData.forEach((c) => {
        contextParts.push(
          `- ${c.name}: Visibility ${c.visibility.toFixed(1)}, ${c.mentions} mentions`,
        )
      })
    }

    if (context.conversationHistory?.length) {
      contextParts.push('\nConversation History:')
      context.conversationHistory.slice(-5).forEach((msg) => {
        contextParts.push(`${msg.role}: ${msg.content.slice(0, 200)}`)
      })
    }

    return [this.systemPrompt, contextParts.join('\n'), `\nUser Question: ${userMessage}`].join(
      '\n\n',
    )
  }

  abstract getResponse(message: string, context: AgentContext): Promise<AgentResponse>
}
