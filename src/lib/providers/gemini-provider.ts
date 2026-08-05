import type { AIProviderRequest, AIProviderResult } from './types'
import { BaseProvider } from './base-provider'
import { estimateBlendedCost } from '@/lib/cost-monitor/types'

export class GeminiProvider extends BaseProvider {
  readonly id = 'gemini' as const
  readonly name = 'Google Gemini'

  isConfigured(): boolean {
    return !!process.env['GEMINI_API_KEY']
  }

  protected override async healthCheckRequest(): Promise<Response> {
    const apiKey = process.env['GEMINI_API_KEY']
    return fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
  }

  protected override async executeRequest(
    request: AIProviderRequest,
    signal?: AbortSignal,
  ): Promise<Response> {
    const apiKey = process.env['GEMINI_API_KEY']

    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: request.prompt }] }],
      generationConfig: {
        temperature: request.temperature ?? 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: request.maxTokens ?? 4096,
      },
    }

    if (request.systemPrompt) {
      body.systemInstruction = { parts: [{ text: request.systemPrompt }] }
    }

    return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      },
    )
  }

  protected override transformResponse(data: unknown): AIProviderResult {
    const response = data as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
      }>
      usageMetadata?: { totalTokenCount?: number }
    }

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const tokensUsed = response.usageMetadata?.totalTokenCount || 0

    return {
      success: !!text,
      text,
      provider: this.id,
      tokensUsed,
      costEstimate: this.estimateCost(tokensUsed),
    }
  }

  protected override estimateCost(tokens: number): number {
    // Was `tokens * 0.000075`, i.e. the PER-MILLION price used as a per-token
    // one: $75 per million tokens against a real $0.075–$0.30. Roughly 250×,
    // flowing into ai_cost_logs through the agent path.
    //
    // Only a total token count is available here, so this prices all of it at
    // the higher output rate — an estimate that errs upward is the right way
    // for a number a budget alert reads.
    return estimateBlendedCost('gemini-2.5-flash', tokens)
  }
}
