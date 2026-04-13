// PATH: src/app/api/v1/credits/estimate/route.ts
// POST /api/v1/credits/estimate — Estimate cost for model + messages

import { type NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId, AuthError } from '@/lib/supabase'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import {
  calculateCost,
  estimateCost,
  getModelPricing,
  getProviderFromModel,
} from '@/lib/services/credit-calculator'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`credits-estimate:${ip}`, 10, 60_000)
  if (!rateCheck.success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
      },
    )
  }

  let body: {
    model?: string
    messages?: Array<{ role: string; content: string }>
    inputTokens?: number
    outputTokens?: number
  }
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const { model, messages, inputTokens, outputTokens } = body

  if (!model) {
    return err('model is required', 400)
  }

  const pricing = getModelPricing(model)
  if (!pricing) {
    return err(
      `Unknown model: ${model}. Valid models: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo, claude-3.5-sonnet, claude-3-opus, claude-3-haiku, gemini-2.0-flash, gemini-2.0-flash-lite, gemini-1.5-pro, gemini-1.5-flash, sonar-small, sonar-medium`,
      400,
    )
  }

  let estimatedCost = 0

  if (messages && messages.length > 0) {
    estimatedCost = estimateCost(model, messages as any)
  } else if (typeof inputTokens === 'number' && typeof outputTokens === 'number') {
    estimatedCost = calculateCost(model, inputTokens, outputTokens)
  } else {
    return err('Either messages[] or inputTokens + outputTokens required', 400)
  }

  const provider = getProviderFromModel(model)

  return NextResponse.json({
    success: true,
    estimate: {
      model,
      provider,
      estimatedCost: Math.round(estimatedCost * 100) / 100,
      pricing: {
        inputPer1K: pricing.input,
        outputPer1K: pricing.output,
      },
      timestamp: new Date().toISOString(),
    },
  })
}
