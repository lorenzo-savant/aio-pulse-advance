import type { AIProvider, AIProviderRequest, AIProviderResult } from './types'

export class GeminiProvider implements AIProvider {
  id = 'gemini' as const
  name = 'Google Gemini'

  isConfigured(): boolean {
    return !!process.env['GEMINI_API_KEY']
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isConfigured()) return false
    try {
      const apiKey = process.env['GEMINI_API_KEY']
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      const res = await fetch(url, { method: 'GET' })
      return res.ok
    } catch {
      return false
    }
  }

  async execute(request: AIProviderRequest): Promise<AIProviderResult> {
    const startTime = Date.now()
    const apiKey = process.env['GEMINI_API_KEY']

    if (!apiKey) {
      return {
        success: false,
        provider: this.id,
        error: 'GEMINI_API_KEY not configured',
        latencyMs: Date.now() - startTime,
      }
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

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

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      })

      if (!res.ok) {
        const errorText = await res.text()
        return {
          success: false,
          provider: this.id,
          error: `Gemini API error: ${res.status} - ${errorText}`,
          latencyMs: Date.now() - startTime,
        }
      }

      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text

      if (!text) {
        return {
          success: false,
          provider: this.id,
          error: 'Empty response from Gemini',
          latencyMs: Date.now() - startTime,
        }
      }

      return {
        success: true,
        text,
        provider: this.id,
        latencyMs: Date.now() - startTime,
        tokensUsed: data.usageMetadata?.totalTokenCount,
        costEstimate: this.estimateCost(data.usageMetadata?.totalTokenCount ?? 0),
      }
    } catch (err) {
      return {
        success: false,
        provider: this.id,
        error: err instanceof Error ? err.message : 'Unknown Gemini error',
        latencyMs: Date.now() - startTime,
      }
    }
  }

  private estimateCost(tokens: number): number {
    return tokens * 0.000075
  }
}
