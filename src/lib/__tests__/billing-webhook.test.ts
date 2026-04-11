import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'crypto'

// ── Helpers ────────────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = 'whsec_test_secret_key'

function makeSignature(payload: string, secret: string = WEBHOOK_SECRET): string {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signedPayload = `${timestamp}.${payload}`
  const sig = createHmac('sha256', secret).update(signedPayload).digest('hex')
  return `t=${timestamp},v1=${sig}`
}

function makeRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/billing/webhook', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  })
}

function makeEvent(type: string, dataObject: Record<string, unknown>) {
  return { id: `evt_${Date.now()}`, type, data: { object: dataObject } }
}

// ── Mock setup ─────────────────────────────────────────────────────────────────

// Chain-able mock for Supabase query builder
function createChainMock(resolvedValue: { data: unknown; error: unknown } = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.insert = vi.fn().mockResolvedValue(resolvedValue)
  chain.upsert = vi.fn().mockResolvedValue(resolvedValue)
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(resolvedValue)
  chain.update = vi.fn().mockReturnValue(chain)
  return chain
}

let mockChain: ReturnType<typeof createChainMock>
let mockFrom: ReturnType<typeof vi.fn>

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// We need dynamic import so mocks are registered before the module loads
async function getPostHandler() {
  const mod = await import('@/app/api/billing/webhook/route')
  return mod.POST
}

describe('Billing Webhook Handler', () => {
  let POST: Awaited<ReturnType<typeof getPostHandler>>

  beforeEach(async () => {
    vi.resetModules()
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET)
    vi.stubEnv('SUPABASE_SERVICE_KEY', 'test-service-key')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')

    mockChain = createChainMock()
    mockFrom = vi.fn().mockReturnValue(mockChain)

    const { createServerClient } = await import('@/lib/supabase')
    vi.mocked(createServerClient).mockReturnValue({ from: mockFrom } as any)

    POST = await getPostHandler()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // ── 1. Stripe signature verification ──────────────────────────────────────

  describe('Stripe signature verification', () => {
    it('returns 400 when stripe-signature header is missing', async () => {
      const req = makeRequest('{}')
      const res = await POST(req as any)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toMatch(/Missing stripe-signature/i)
    })

    it('returns 400 when signature is invalid', async () => {
      const body = JSON.stringify(makeEvent('checkout.session.completed', {}))
      const req = makeRequest(body, {
        'stripe-signature': 't=12345,v1=invalidsignature',
      })
      const res = await POST(req as any)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toMatch(/verification failed/i)
    })

    it('returns 400 when signature format is malformed (no t= or v1=)', async () => {
      const body = JSON.stringify(makeEvent('checkout.session.completed', {}))
      const req = makeRequest(body, { 'stripe-signature': 'garbage' })
      const res = await POST(req as any)
      expect(res.status).toBe(400)
    })

    it('processes event when signature is valid', async () => {
      const event = makeEvent('unknown.event.type', {})
      const body = JSON.stringify(event)
      const sig = makeSignature(body)
      const req = makeRequest(body, { 'stripe-signature': sig })
      const res = await POST(req as any)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.received).toBe(true)
    })

    it('returns 500 when STRIPE_WEBHOOK_SECRET is not configured', async () => {
      vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
      // re-import to pick up new env
      vi.resetModules()
      const freshPOST = await getPostHandler()
      const req = makeRequest('{}', { 'stripe-signature': 'test' })
      const res = await freshPOST(req as any)
      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.error).toMatch(/not configured/i)
    })
  })

  // ── 2. checkout.session.completed ─────────────────────────────────────────

  describe('checkout.session.completed', () => {
    it('inserts credits for a credit package purchase', async () => {
      const event = makeEvent('checkout.session.completed', {
        metadata: {
          user_id: 'user-123',
          package_id: 'pkg-100',
          credits: '100',
          bonus: '20',
        },
        customer: 'cus_abc',
        subscription: null,
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      expect(mockFrom).toHaveBeenCalledWith('credits')
      expect(mockChain.insert).toHaveBeenCalledWith({
        user_id: 'user-123',
        amount: 120, // 100 + 20 bonus
        source: 'stripe_purchase',
        description: 'Purchased 100 credits + 20 bonus',
      })
    })

    it('inserts credits with zero bonus when bonus is absent', async () => {
      const event = makeEvent('checkout.session.completed', {
        metadata: {
          user_id: 'user-456',
          package_id: 'pkg-50',
          credits: '50',
        },
        customer: 'cus_def',
        subscription: null,
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 50, user_id: 'user-456' }),
      )
    })

    it('upserts subscription for a plan purchase', async () => {
      const event = makeEvent('checkout.session.completed', {
        metadata: { user_id: 'user-789', plan: 'pro' },
        customer: 'cus_ghi',
        subscription: 'sub_001',
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      expect(mockFrom).toHaveBeenCalledWith('subscriptions')
      expect(mockChain.upsert).toHaveBeenCalledWith(
        {
          user_id: 'user-789',
          stripe_customer_id: 'cus_ghi',
          stripe_sub_id: 'sub_001',
          plan: 'pro',
          status: 'active',
        },
        { onConflict: 'user_id' },
      )
    })

    it('handles both credits and subscription in one checkout', async () => {
      const event = makeEvent('checkout.session.completed', {
        metadata: {
          user_id: 'user-combo',
          plan: 'business',
          package_id: 'pkg-200',
          credits: '200',
          bonus: '50',
        },
        customer: 'cus_combo',
        subscription: 'sub_combo',
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      expect(mockChain.insert).toHaveBeenCalled()
      expect(mockChain.upsert).toHaveBeenCalled()
    })

    it('does nothing when metadata has no user_id', async () => {
      const event = makeEvent('checkout.session.completed', {
        metadata: {},
        customer: 'cus_noid',
        subscription: null,
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      expect(mockChain.insert).not.toHaveBeenCalled()
      expect(mockChain.upsert).not.toHaveBeenCalled()
    })
  })

  // ── 3. customer.subscription.updated ──────────────────────────────────────

  describe('customer.subscription.updated', () => {
    it('updates subscription status and period end', async () => {
      mockChain.single = vi.fn().mockResolvedValue({
        data: { user_id: 'user-upd' },
        error: null,
      })
      const periodEnd = Math.floor(Date.now() / 1000) + 86400
      const event = makeEvent('customer.subscription.updated', {
        id: 'sub_upd',
        customer: 'cus_upd',
        status: 'active',
        current_period_end: periodEnd,
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      expect(mockChain.update).toHaveBeenCalledWith({
        status: 'active',
        current_period_end: new Date(periodEnd * 1000).toISOString(),
        stripe_sub_id: 'sub_upd',
      })
    })

    it('preserves non-active status values', async () => {
      mockChain.single = vi.fn().mockResolvedValue({
        data: { user_id: 'user-trial' },
        error: null,
      })
      const event = makeEvent('customer.subscription.updated', {
        id: 'sub_trial',
        customer: 'cus_trial',
        status: 'trialing',
        current_period_end: null,
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'trialing' }),
      )
    })

    it('does nothing when subscription is not found in DB', async () => {
      mockChain.single = vi.fn().mockResolvedValue({ data: null, error: null })
      const event = makeEvent('customer.subscription.updated', {
        id: 'sub_ghost',
        customer: 'cus_ghost',
        status: 'active',
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      expect(mockChain.update).not.toHaveBeenCalled()
    })
  })

  // ── 4. customer.subscription.deleted ──────────────────────────────────────

  describe('customer.subscription.deleted', () => {
    it('marks subscription as canceled and sets plan to free', async () => {
      mockChain.single = vi.fn().mockResolvedValue({
        data: { user_id: 'user-del' },
        error: null,
      })
      const event = makeEvent('customer.subscription.deleted', {
        customer: 'cus_del',
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      expect(mockChain.update).toHaveBeenCalledWith({
        plan: 'free',
        status: 'canceled',
        stripe_sub_id: null,
      })
    })

    it('does nothing when customer not found in DB', async () => {
      mockChain.single = vi.fn().mockResolvedValue({ data: null, error: null })
      const event = makeEvent('customer.subscription.deleted', {
        customer: 'cus_unknown',
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      expect(mockChain.update).not.toHaveBeenCalled()
    })
  })

  // ── 5. invoice.payment_failed ─────────────────────────────────────────────

  describe('invoice.payment_failed', () => {
    it('sets subscription status to past_due', async () => {
      mockChain.single = vi.fn().mockResolvedValue({
        data: { user_id: 'user-fail' },
        error: null,
      })
      const event = makeEvent('invoice.payment_failed', {
        customer: 'cus_fail',
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      expect(mockChain.update).toHaveBeenCalledWith({ status: 'past_due' })
    })

    it('does nothing when customer not found in DB', async () => {
      mockChain.single = vi.fn().mockResolvedValue({ data: null, error: null })
      const event = makeEvent('invoice.payment_failed', {
        customer: 'cus_missing',
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      expect(mockChain.update).not.toHaveBeenCalled()
    })
  })

  // ── 6. Unknown event types ────────────────────────────────────────────────

  describe('Unknown event types', () => {
    it('ignores unhandled event types gracefully and returns 200', async () => {
      const event = makeEvent('payment_intent.created', { id: 'pi_abc' })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.received).toBe(true)
    })

    it('ignores completely unknown event types', async () => {
      const event = makeEvent('some.random.event', {})
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      expect(res.status).toBe(200)
    })
  })

  // ── 7. Credit insertion logic ─────────────────────────────────────────────

  describe('Credit insertion logic', () => {
    it('calculates correct total with integer credits and bonus', async () => {
      const event = makeEvent('checkout.session.completed', {
        metadata: {
          user_id: 'user-math',
          package_id: 'pkg-calc',
          credits: '500',
          bonus: '100',
        },
        customer: 'cus_math',
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      await POST(req as any)

      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 600 }),
      )
    })

    it('maps correct user_id from session metadata', async () => {
      const event = makeEvent('checkout.session.completed', {
        metadata: {
          user_id: 'specific-user-id-xyz',
          package_id: 'pkg-map',
          credits: '10',
        },
        customer: 'cus_map',
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      await POST(req as any)

      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'specific-user-id-xyz' }),
      )
    })

    it('sets source to stripe_purchase', async () => {
      const event = makeEvent('checkout.session.completed', {
        metadata: {
          user_id: 'user-src',
          package_id: 'pkg-src',
          credits: '25',
        },
        customer: 'cus_src',
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      await POST(req as any)

      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'stripe_purchase' }),
      )
    })
  })

  // ── 8. Error handling ─────────────────────────────────────────────────────

  describe('Error handling', () => {
    it('returns 400 for malformed JSON payload', async () => {
      const badBody = 'this is not json {'
      const req = makeRequest(badBody, { 'stripe-signature': makeSignature(badBody) })
      const res = await POST(req as any)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toMatch(/Invalid payload/i)
    })

    it('returns 500 when credit insert throws', async () => {
      mockChain.insert = vi.fn().mockRejectedValue(new Error('DB insert failed'))
      const event = makeEvent('checkout.session.completed', {
        metadata: {
          user_id: 'user-err',
          package_id: 'pkg-err',
          credits: '10',
        },
        customer: 'cus_err',
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.error).toMatch(/Webhook handler failed/i)
    })

    it('returns 500 when subscription upsert throws', async () => {
      mockChain.upsert = vi.fn().mockRejectedValue(new Error('DB upsert failed'))
      const event = makeEvent('checkout.session.completed', {
        metadata: { user_id: 'user-sub-err', plan: 'pro' },
        customer: 'cus_sub_err',
        subscription: 'sub_err',
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      expect(res.status).toBe(500)
    })

    it('returns 500 when subscription update throws during subscription.updated', async () => {
      mockChain.single = vi.fn().mockResolvedValue({
        data: { user_id: 'user-upd-err' },
        error: null,
      })
      mockChain.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockRejectedValue(new Error('DB update failed')),
      })
      const event = makeEvent('customer.subscription.updated', {
        id: 'sub_upd_err',
        customer: 'cus_upd_err',
        status: 'active',
        current_period_end: 1700000000,
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      expect(res.status).toBe(500)
    })

    it('returns 500 when subscription lookup throws during subscription.deleted', async () => {
      mockChain.single = vi.fn().mockRejectedValue(new Error('DB lookup failed'))
      const event = makeEvent('customer.subscription.deleted', {
        customer: 'cus_lookup_err',
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      expect(res.status).toBe(500)
    })

    it('returns 503 when database client is null', async () => {
      vi.resetModules()
      vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET)

      const { createServerClient } = await import('@/lib/supabase')
      vi.mocked(createServerClient).mockReturnValue(null)

      const freshPOST = await getPostHandler()
      const event = makeEvent('checkout.session.completed', {})
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await freshPOST(req as any)

      expect(res.status).toBe(503)
      const json = await res.json()
      expect(json.error).toMatch(/Database not configured/i)
    })

    it('returns 500 when payment_failed update throws', async () => {
      mockChain.single = vi.fn().mockResolvedValue({
        data: { user_id: 'user-pf-err' },
        error: null,
      })
      mockChain.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockRejectedValue(new Error('DB update failed')),
      })
      const event = makeEvent('invoice.payment_failed', {
        customer: 'cus_pf_err',
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      expect(res.status).toBe(500)
    })

    it('returns 500 when event data.object is missing', async () => {
      const event = { id: 'evt_bad', type: 'checkout.session.completed', data: {} }
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      // Accessing .metadata on undefined throws, caught by the try/catch
      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.error).toMatch(/Webhook handler failed/i)
    })
  })

  // ── 9. Edge cases ─────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('handles subscription.updated with null current_period_end', async () => {
      mockChain.single = vi.fn().mockResolvedValue({
        data: { user_id: 'user-null-period' },
        error: null,
      })
      const event = makeEvent('customer.subscription.updated', {
        id: 'sub_null_period',
        customer: 'cus_null_period',
        status: 'active',
        current_period_end: null,
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      const res = await POST(req as any)

      expect(res.status).toBe(200)
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ current_period_end: null }),
      )
    })

    it('handles checkout with credits but no bonus field at all', async () => {
      const event = makeEvent('checkout.session.completed', {
        metadata: {
          user_id: 'user-no-bonus',
          package_id: 'pkg-nobonus',
          credits: '75',
          // no bonus key
        },
        customer: 'cus_nobonus',
      })
      const body = JSON.stringify(event)
      const req = makeRequest(body, { 'stripe-signature': makeSignature(body) })
      await POST(req as any)

      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 75 }),
      )
    })
  })
})
