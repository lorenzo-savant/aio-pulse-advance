// PATH: src/app/api/billing/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

// ─── POST /api/billing — Stripe webhook handler ─────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET not configured', { source: 'billing' })
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  // Stripe SDK: constant-time signature compare + timestamp tolerance
  // (default 300s) → replay protection. Throws on any mismatch.
  let event: Stripe.Event
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_not_configured')
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    logger.error('Signature verification failed', {
      source: 'billing',
      err: err instanceof Error ? err.message : 'unknown',
    })
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  const db = createServerClient()
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any
        const userId = session.metadata?.user_id
        const plan = session.metadata?.plan
        const customerId = session.customer
        const subscriptionId = session.subscription
        const packageId = session.metadata?.package_id
        const credits = session.metadata?.credits
        const bonus = session.metadata?.bonus

        // Handle credit package purchases
        if (userId && packageId && credits) {
          const totalCredits = parseInt(credits) + (parseInt(bonus) || 0)

          // Add credits to user account
          await db.from('credits').insert({
            user_id: userId,
            amount: totalCredits,
            source: 'stripe_purchase',
            description: `Purchased ${credits} credits + ${bonus || 0} bonus`,
          })

          logger.info('Credits added', { source: 'billing', totalCredits, userId })
        }

        // Handle subscription purchases
        if (userId && plan) {
          await db.from('subscriptions').upsert(
            {
              user_id: userId,
              stripe_customer_id: customerId,
              stripe_sub_id: subscriptionId,
              plan,
              status: 'active',
            },
            { onConflict: 'user_id' },
          )
          logger.info('Subscription activated', { source: 'billing' })
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any
        const customerId = subscription.customer

        const { data: sub } = await db
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (sub) {
          const periodEnd = subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null

          await db
            .from('subscriptions')
            .update({
              status: subscription.status === 'active' ? 'active' : subscription.status,
              current_period_end: periodEnd,
              stripe_sub_id: subscription.id,
            })
            .eq('user_id', sub.user_id)

          logger.info('Subscription updated', { source: 'billing' })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any
        const customerId = subscription.customer

        const { data: sub } = await db
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (sub) {
          await db
            .from('subscriptions')
            .update({
              plan: 'free',
              status: 'canceled',
              stripe_sub_id: null,
            })
            .eq('user_id', sub.user_id)

          logger.info('Subscription canceled', { source: 'billing' })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any
        const customerId = invoice.customer

        const { data: sub } = await db
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (sub) {
          await db.from('subscriptions').update({ status: 'past_due' }).eq('user_id', sub.user_id)

          logger.warn('Payment failed', { source: 'billing' })
        }
        break
      }

      default:
        logger.debug('Unhandled event', { source: 'billing', eventType: event.type })
    }
  } catch (error) {
    logger.error('Error processing event', { source: 'billing', error: String(error) })
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
