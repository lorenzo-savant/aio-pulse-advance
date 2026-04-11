// PATH: src/app/api/credits/route.ts
// Credits API — GET balance, POST add/deduct

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// ─── GET /api/credits — Get credit balance ──────────────────────────────────
export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  try {
    const { data: credits, error: creditsError } = await db
      .from('credits')
      .select('amount, source, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (creditsError) throw creditsError

    const totalPurchased =
      (credits || [])
        .filter((c: any) => c.amount > 0)
        .reduce((sum: number, c: any) => sum + c.amount, 0)

    const totalUsed =
      (credits || [])
        .filter((c: any) => c.amount < 0)
        .reduce((sum: number, c: any) => sum + Math.abs(c.amount), 0)

    const balance = totalPurchased - totalUsed

    // Get subscription info
    const { data: subscription } = await db
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', userId)
      .single()

    return NextResponse.json({
      success: true,
      credits: {
        userId,
        totalCredits: totalPurchased,
        usedCredits: totalUsed,
        availableCredits: balance,
        lastUpdated: new Date().toISOString(),
      },
      plan: subscription?.plan || 'free',
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('[credits] Error fetching balance:', error)
    return err('Failed to fetch credits')
  }
}

// ─── POST /api/credits — Add or deduct credits ─────────────────────────────
export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  let body: { action?: string; amount?: number; description?: string }
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const { action, amount, description } = body
  if (!action || !amount || amount <= 0) {
    return err('action (add/deduct) and positive amount are required', 400)
  }

  if (action !== 'add' && action !== 'deduct') {
    return err('action must be "add" or "deduct"', 400)
  }

  try {
    const creditAmount = action === 'deduct' ? -amount : amount

    const { error: insertError } = await db.from('credits').insert({
      user_id: userId,
      amount: creditAmount,
      source: action === 'add' ? 'manual_add' : 'manual_deduct',
      description: description || `${action} ${amount} credits`,
    })

    if (insertError) throw insertError

    // Fetch updated balance
    const { data: credits } = await db
      .from('credits')
      .select('amount')
      .eq('user_id', userId)

    const totalPurchased =
      (credits || [])
        .filter((c: any) => c.amount > 0)
        .reduce((sum: number, c: any) => sum + c.amount, 0)

    const totalUsed =
      (credits || [])
        .filter((c: any) => c.amount < 0)
        .reduce((sum: number, c: any) => sum + Math.abs(c.amount), 0)

    return NextResponse.json({
      success: true,
      credits: {
        userId,
        totalCredits: totalPurchased,
        usedCredits: totalUsed,
        availableCredits: totalPurchased - totalUsed,
        lastUpdated: new Date().toISOString(),
      },
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('[credits] Error:', error)
    return err('Failed to process credits')
  }
}
