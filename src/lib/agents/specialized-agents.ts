import { BaseAgent, type AgentContext, type AgentResponse } from './base-agent'
import type { AIProviderId } from '@/lib/providers/types'
import { getProviderManager } from '@/lib/providers/provider-manager'
import type { AIProviderRequest } from '@/lib/providers/types'

export class BrandMonitorAgent extends BaseAgent {
  readonly id = 'brand_monitor'
  readonly name = 'Brand Monitor'
  readonly description = 'Real-time brand health and visibility analysis'
  readonly optimalProvider: AIProviderId = 'perplexity'
  readonly systemPrompt = `You are a Brand Monitoring Specialist for AEO Pulse Advance. Your role is to analyze brand health, visibility trends, and AI citation performance.

Key capabilities:
- Analyze health score trends and identify patterns
- Explain visibility changes and their causes
- Assess AI Overview citation performance
- Provide actionable recommendations for brand improvement
- Alert about significant metric changes
- Interpret SEO/AEO/E-E-A-T audit results and GEO Citation Scores

Always reference specific metrics when answering. Be concise and data-driven. If metrics show negative trends, explain potential causes and suggest fixes. When audit data is provided, prioritize critical and high-priority issues.`

  async getResponse(message: string, context: AgentContext): Promise<AgentResponse> {
    const manager = getProviderManager()
    const prompt = this.buildPrompt(message, context)

    const request: AIProviderRequest = {
      prompt,
      systemPrompt: this.systemPrompt,
      temperature: 0.5,
      maxTokens: 800,
    }

    const result = await manager.executeWithProvider(request, this.optimalProvider)

    return {
      success: result.success,
      content: result.text || '',
      provider: this.optimalProvider,
      latencyMs: result.latencyMs,
      tokensUsed: result.tokensUsed,
      costEstimate: result.costEstimate,
    }
  }
}

export class CompetitorAnalystAgent extends BaseAgent {
  readonly id = 'competitor_analyst'
  readonly name = 'Competitor Analyst'
  readonly description = 'Competitive positioning and gap analysis'
  readonly optimalProvider: AIProviderId = 'dataforseo'
  readonly systemPrompt = `You are a Competitive Intelligence Analyst for AEO Pulse Advance. Your role is to analyze competitor positioning, identify market gaps, and provide strategic insights.

Key capabilities:
- Compare brand visibility against competitors
- Identify competitor strategies and tactics
- Find market gaps and opportunities
- Analyze SERP competition for key terms
- Recommend competitive differentiation strategies

Focus on actionable competitive intelligence. Reference specific competitor data when available. Suggest strategies to outperform competitors in AI Overviews and search results.`

  async getResponse(message: string, context: AgentContext): Promise<AgentResponse> {
    const manager = getProviderManager()
    const prompt = this.buildPrompt(message, context)

    const request: AIProviderRequest = {
      prompt,
      systemPrompt: this.systemPrompt,
      temperature: 0.6,
      maxTokens: 1000,
    }

    const result = await manager.executeWithProvider(request, this.optimalProvider)

    return {
      success: result.success,
      content: result.text || '',
      provider: this.optimalProvider,
      latencyMs: result.latencyMs,
      tokensUsed: result.tokensUsed,
      costEstimate: result.costEstimate,
    }
  }
}

export class KeywordExpertAgent extends BaseAgent {
  readonly id = 'keyword_expert'
  readonly name = 'Keyword Expert'
  readonly description = 'Search volume, trends, and intent analysis'
  readonly optimalProvider: AIProviderId = 'gemini'
  readonly systemPrompt = `You are a Keyword Research Expert for AEO Pulse Advance. Your role is to analyze keyword performance, search intent, and optimization opportunities.

Key capabilities:
- Analyze keyword search volume and competition
- Identify keyword intent patterns (informational, transactional, commercial, navigational)
- Suggest high-opportunity keywords
- Explain keyword ranking changes
- Recommend content optimization strategies

Provide specific keyword recommendations with data backing. Focus on keywords that drive AI Overview citations and improve brand visibility.`

  async getResponse(message: string, context: AgentContext): Promise<AgentResponse> {
    const manager = getProviderManager()
    const prompt = this.buildPrompt(message, context)

    const request: AIProviderRequest = {
      prompt,
      systemPrompt: this.systemPrompt,
      temperature: 0.4,
      maxTokens: 900,
    }

    const result = await manager.executeWithProvider(request, this.optimalProvider)

    return {
      success: result.success,
      content: result.text || '',
      provider: this.optimalProvider,
      latencyMs: result.latencyMs,
      tokensUsed: result.tokensUsed,
      costEstimate: result.costEstimate,
    }
  }
}

export class ReportBuilderAgent extends BaseAgent {
  readonly id = 'report_builder'
  readonly name = 'Report Builder'
  readonly description = 'Generate and customize performance reports'
  readonly optimalProvider: AIProviderId = 'claude'
  readonly systemPrompt = `You are a Report Generation Specialist for AEO Pulse Advance. Your role is to create comprehensive, client-ready performance reports from brand data.

Key capabilities:
- Generate executive summaries from raw metrics
- Create structured reports with clear sections
- Highlight key achievements and areas for improvement
- Provide visual data descriptions for charts
- Format reports for client presentation

Structure reports with: Executive Summary, Key Metrics, Trends, Competitor Analysis, Recommendations. Use professional, client-friendly language. Include specific numbers and percentages.`

  async getResponse(message: string, context: AgentContext): Promise<AgentResponse> {
    const manager = getProviderManager()
    const prompt = this.buildPrompt(message, context)

    const request: AIProviderRequest = {
      prompt,
      systemPrompt: this.systemPrompt,
      temperature: 0.3,
      maxTokens: 2000,
    }

    const result = await manager.executeWithProvider(request, this.optimalProvider)

    return {
      success: result.success,
      content: result.text || '',
      provider: this.optimalProvider,
      latencyMs: result.latencyMs,
      tokensUsed: result.tokensUsed,
      costEstimate: result.costEstimate,
    }
  }
}

export class AuditAgent extends BaseAgent {
  readonly id = 'audit_expert'
  readonly name = 'Audit Expert'
  readonly description = 'SEO/AEO/E-E-A-T site audits with fix briefs'
  readonly optimalProvider: AIProviderId = 'claude'
  readonly systemPrompt = `You are an SEO/AEO/E-E-A-T Audit Expert for AEO Pulse Advance, inspired by Stobo MCP and Barrett's GEO research framework.

Key capabilities:
- Analyze full site audits (30+ SEO checks, 7+ AEO checks, E-E-A-T signals)
- Interpret GEO Citation Scores (semantic authority, source attribution, freshness, structured data, entity salience, trust signals)
- Generate prioritized fix briefs with estimated effort
- Recommend llms.txt generation for AI crawler optimization
- Check content freshness and suggest updates
- Explain how to get cited in ChatGPT, Perplexity, Gemini, and Claude

When audit data is provided:
1. Summarize the overall score and weakest areas
2. List critical and high-priority issues first
3. Provide specific, actionable fix instructions
4. Estimate effort for each fix
5. Explain how fixes improve GEO Citation Score

Reference Barrett's GEO framework: semantic authority building, forensic AI auditing, HITL integration, and "share of model" optimization.`

  async getResponse(message: string, context: AgentContext): Promise<AgentResponse> {
    const manager = getProviderManager()
    const prompt = this.buildPrompt(message, context)

    const request: AIProviderRequest = {
      prompt,
      systemPrompt: this.systemPrompt,
      temperature: 0.4,
      maxTokens: 2000,
    }

    const result = await manager.executeWithProvider(request, this.optimalProvider)

    return {
      success: result.success,
      content: result.text || '',
      provider: this.optimalProvider,
      latencyMs: result.latencyMs,
      tokensUsed: result.tokensUsed,
      costEstimate: result.costEstimate,
    }
  }
}
