import { beforeEach, describe, expect, it, vi } from 'vitest'

// Fixed test values, set before the route (and lib/stripe's sk_test_ guard) is imported.
const { WEBHOOK_SECRET, payloadMock } = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_unit'
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_unit_test'
  return {
    WEBHOOK_SECRET: 'whsec_unit_test',
    payloadMock: { find: vi.fn(), update: vi.fn() },
  }
})

vi.mock('@/lib/payload', () => ({ getPayload: async () => payloadMock }))

import { POST } from '@/app/(frontend)/next/stripe/webhook/route'
import { stripe } from '@/lib/stripe'

const SESSION_ID = 'cs_test_a1B2c3D4e5F6g7H8i9J0kLmNoPqRsTuVwXyZ'
const ORDER_ID = '3f9c2a7e-6b1d-4e0a-9c55-1a2b3c4d5e6f'

const pendingOrder = { id: ORDER_ID, status: 'pending', total: 4900, stripeSessionId: SESSION_ID }

function event(type: string, object: Record<string, unknown> = {}) {
  return {
    id: 'evt_1Q9xYzAbCdEfGhIj',
    object: 'event',
    type,
    created: 1_790_000_000,
    data: {
      object: {
        id: SESSION_ID,
        object: 'checkout.session',
        payment_status: 'paid',
        payment_intent: 'pi_3Q9xYzAbCdEfGhIj0KlMnOpQ',
        amount_total: 4900,
        currency: 'eur',
        client_reference_id: ORDER_ID,
        metadata: { orderId: ORDER_ID, orderNumber: 'AM-2026-000042' },
        customer_details: { email: 'jonas.weber@example.com', name: 'Jonas Weber' },
        collected_information: {
          shipping_details: {
            name: 'Jonas Weber',
            address: { line1: 'Bergmannstraße 12', line2: null, postal_code: '10961', city: 'Berlin', state: null, country: 'DE' },
          },
        },
        ...object,
      },
    },
  }
}

function signedRequest(body: unknown, secret = WEBHOOK_SECRET) {
  const payload = JSON.stringify(body)
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret })
  return new Request('http://localhost:3000/next/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': signature, 'content-type': 'application/json' },
    body: payload,
  })
}

beforeEach(() => {
  payloadMock.find.mockReset().mockResolvedValue({ docs: [pendingOrder] })
  payloadMock.update.mockReset().mockResolvedValue({})
})

describe('POST /next/stripe/webhook (SPEC Block D2)', () => {
  it('marks a pending order paid when the signature is valid', async () => {
    const res = await POST(signedRequest(event('checkout.session.completed')))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
    expect(payloadMock.find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'orders', where: { stripeSessionId: { equals: SESSION_ID } } }),
    )
    expect(payloadMock.update).toHaveBeenCalledTimes(1)
    expect(payloadMock.update).toHaveBeenCalledWith({
      collection: 'orders',
      id: ORDER_ID,
      overrideAccess: true,
      depth: 0,
      data: {
        status: 'paid',
        paidAt: new Date(1_790_000_000 * 1000).toISOString(),
        stripePaymentIntentId: 'pi_3Q9xYzAbCdEfGhIj0KlMnOpQ',
        customerEmail: 'jonas.weber@example.com',
        total: 4900,
        shippingAddress: {
          name: 'Jonas Weber',
          line1: 'Bergmannstraße 12',
          line2: undefined,
          postalCode: '10961',
          city: 'Berlin',
          state: undefined,
          country: 'DE',
        },
      },
    })
  })

  it('falls back to the legacy session.shipping_details location', async () => {
    const legacy = event('checkout.session.completed', {
      collected_information: null,
      shipping_details: { name: 'Lena Huber', address: { line1: 'Kärntner Straße 5', postal_code: '1010', city: 'Wien', country: 'AT' } },
    })
    await POST(signedRequest(legacy))
    expect(payloadMock.update.mock.calls[0][0].data.shippingAddress).toMatchObject({ name: 'Lena Huber', country: 'AT' })
  })

  it('rejects an invalid signature with 400 before touching the database', async () => {
    const res = await POST(signedRequest(event('checkout.session.completed'), 'whsec_wrong_secret'))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed.' },
    })
    expect(payloadMock.find).not.toHaveBeenCalled()
    expect(payloadMock.update).not.toHaveBeenCalled()
  })

  it('rejects a request without a signature header with 400', async () => {
    const req = new Request('http://localhost:3000/next/stripe/webhook', {
      method: 'POST',
      body: JSON.stringify(event('checkout.session.completed')),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(payloadMock.find).not.toHaveBeenCalled()
  })

  it.each([
    ['checkout.session.completed', 'paid'],
    ['checkout.session.expired', 'paid'],
    ['checkout.session.expired', 'cancelled'],
  ])('acknowledges %s for an already-%s order with 200 and no write', async (type, status) => {
    payloadMock.find.mockResolvedValue({ docs: [{ ...pendingOrder, status }] })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const res = await POST(signedRequest(event(type)))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
    expect(payloadMock.update).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(`order ${ORDER_ID} already ${status}, event evt_1Q9xYzAbCdEfGhIj ignored`)
    warn.mockRestore()
  })

  it('logs an error when a cancelled order is paid, and still acknowledges with 200', async () => {
    payloadMock.find.mockResolvedValue({ docs: [{ ...pendingOrder, status: 'cancelled' }] })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(signedRequest(event('checkout.session.completed')))

    expect(res.status).toBe(200)
    expect(payloadMock.update).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(
      `paid checkout for cancelled order ${ORDER_ID}, payment_intent pi_3Q9xYzAbCdEfGhIj0KlMnOpQ: refund in Stripe`,
    )
    error.mockRestore()
  })

  it('moves a pending order to cancelled on checkout.session.expired', async () => {
    const res = await POST(signedRequest(event('checkout.session.expired', { payment_status: 'unpaid' })))

    expect(res.status).toBe(200)
    expect(payloadMock.update).toHaveBeenCalledWith({
      collection: 'orders',
      id: ORDER_ID,
      overrideAccess: true,
      depth: 0,
      data: { status: 'cancelled' },
    })
  })

  it('returns 404 ORDER_NOT_FOUND for an unknown session', async () => {
    payloadMock.find.mockResolvedValue({ docs: [] })

    const res = await POST(signedRequest(event('checkout.session.completed')))

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({
      error: { code: 'ORDER_NOT_FOUND', message: 'No order matches this Checkout Session.' },
    })
    expect(payloadMock.update).not.toHaveBeenCalled()
  })

  it('returns 500 INTERNAL when the database write fails', async () => {
    payloadMock.update.mockRejectedValue(new Error('connection reset'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(signedRequest(event('checkout.session.completed')))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: { code: 'INTERNAL', message: 'Webhook processing failed.' } })
    expect(error).toHaveBeenCalledWith('webhook processing failed:', 'connection reset')
    error.mockRestore()
  })

  it('acknowledges ignored event types without touching the database', async () => {
    const res = await POST(signedRequest(event('payment_intent.created')))

    expect(res.status).toBe(200)
    expect(payloadMock.find).not.toHaveBeenCalled()
  })
})
