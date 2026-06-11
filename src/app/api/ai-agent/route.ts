import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getAgent, getAllAgents } from '@/lib/agents/agent-registry'
import { createConversation, addMessage, getConversationHistory } from '@/lib/agents/agent-memory'
import type { AgentContext } from '@/lib/agents/base-agent'
import { auditSite, auditArticle } from '@/lib/audit/site-audit'
import { generateFixBrief, formatFixBriefAsMarkdown } from '@/lib/audit/fix-brief'
import { generateLlmstxt, checkFreshness } from '@/lib/audit/generators'
import { getCostTracker } from '@/lib/cost-monitor'
import { requireUser, rateLimitGate } from '@/lib/api-auth'
import { SsrfError } from '@/lib/utils/safe-fetch'
import { logger } from '@/lib/logger'
import { aiAgentMessageSchema, firstZodMessage } from '@/lib/validations'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  const agents = getAllAgents()
  return NextResponse.json({
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      optimalProvider: a.optimalProvider,
    })),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const limited = await rateLimitGate(req, `ai-agent:${userId}`, 20)
  if (limited) return limited

  try {
    const rawBody = await req.json()
    const parsed = aiAgentMessageSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstZodMessage(parsed.error, 'Message required') },
        { status: 400 },
      )
    }
    const { message, agentId, brandId, context, conversationId } = parsed.data

    const agent = getAgent(agentId || 'brand_monitor')
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const agentContext: AgentContext = {
      brand: context?.brand || null,
      healthMetrics: context?.healthMetrics || [],
      gscTrend: context?.gscTrend || [],
      keywords: context?.keywords || [],
      scraperResults: context?.scraperResults || [],
      competitorData: context?.competitorData || [],
    }

    let auditData: string | undefined
    let fixBriefData: string | undefined

    const urlMatch =
      message.match(
        /(?:audit|check|scan|analyze)\s+(?:this\s+)?(?:site|article|page|url)?[:\s]+(https?:\/\/[^\s]+)/i,
      ) || message.match(/(https?:\/\/[^\s]+)/i)

    // urlMatch[1] is the capture group; under noUncheckedIndexedAccess it's
    // string | undefined, so guard on the extracted url rather than the match.
    const url = urlMatch?.[1]
    if (url) {
      if (message.toLowerCase().includes('audit') || message.toLowerCase().includes('scan')) {
        const isArticle =
          message.toLowerCase().includes('article') ||
          message.toLowerCase().includes('post') ||
          message.toLowerCase().includes('blog')
        const audit = isArticle ? await auditArticle(url) : await auditSite(url)
        auditData = JSON.stringify({
          url: audit.url,
          overallScore: audit.overallScore,
          seoScore: audit.seoScore,
          aeoScore: audit.aeoScore,
          eeatScore: audit.eeatScore,
          geoCitationScore: audit.geoCitationScore,
          summary: audit.summary,
          checks: audit.checks.map((c) => ({
            name: c.name,
            status: c.status,
            score: c.score,
            priority: c.priority,
            fix: c.fix,
          })),
        })

        if (message.toLowerCase().includes('fix') || message.toLowerCase().includes('brief')) {
          const brief = generateFixBrief(audit)
          fixBriefData = formatFixBriefAsMarkdown(brief)
        }
      }

      if (message.toLowerCase().includes('freshness') || message.toLowerCase().includes('fresh')) {
        const freshness = await checkFreshness(url)
        auditData = 'Freshness check for ' + url + ': Score ' + freshness.freshnessScore + '/10'
      }

      if (
        message.toLowerCase().includes('llms.txt') ||
        message.toLowerCase().includes('llms txt')
      ) {
        const llmstxt = await generateLlmstxt({ siteUrl: url })
        auditData = 'llms.txt generated for ' + url
      }
    }

    if (auditData) {
      agentContext.healthMetrics = agentContext.healthMetrics || []
      agentContext.healthMetrics.push({
        name: 'Audit Data',
        current: 0,
        previous: 0,
        change: 0,
      })
    }

    // createConversation returns string | null; conversationId from the body is
    // string | undefined. Widen so both assignments below type-check.
    let currentConversationId: string | null | undefined = conversationId

    if (!currentConversationId) {
      currentConversationId = await createConversation(
        userId,
        brandId || null,
        agent.id,
        message.slice(0, 50),
      )
    }

    if (currentConversationId) {
      const history = await getConversationHistory(currentConversationId, 10)
      agentContext.conversationHistory = history
      await addMessage(currentConversationId, 'user', message)
    }

    const enhancedMessage = auditData
      ? message +
        '\n\nAudit Data:\n' +
        auditData +
        (fixBriefData ? '\n\nFix Brief:\n' + fixBriefData : '')
      : message

    const result = await agent.getResponse(enhancedMessage, agentContext)

    if (currentConversationId && result.success) {
      await addMessage(currentConversationId, 'assistant', result.content, {
        providerUsed: result.provider,
        latencyMs: result.latencyMs,
        tokensUsed: result.tokensUsed,
        costEstimate: result.costEstimate,
      })
    }

    if (result.success) {
      const costTracker = getCostTracker()
      const tokensUsed = result.tokensUsed || 0
      await costTracker.logCost({
        userId,
        brandId: brandId || undefined,
        provider: result.provider,
        agentType: agent.id,
        conversationId: currentConversationId || undefined,
        inputTokens: Math.floor(tokensUsed * 0.7),
        outputTokens: Math.floor(tokensUsed * 0.3),
        costUsd: result.costEstimate || 0,
        costCredits: result.costEstimate || 0,
        latencyMs: result.latencyMs || 0,
        success: result.success,
      })
    }

    return NextResponse.json({
      response: result.content,
      agentId: agent.id,
      agentName: agent.name,
      provider: result.provider,
      latencyMs: result.latencyMs,
      tokensUsed: result.tokensUsed,
      costEstimate: result.costEstimate,
      conversationId: currentConversationId,
      hasAudit: !!auditData,
      hasFixBrief: !!fixBriefData,
    })
  } catch (err) {
    if (err instanceof SsrfError) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 })
    }
    logger.error('AI Agent API error', { err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
