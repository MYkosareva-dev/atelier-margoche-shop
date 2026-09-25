import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

import { stripe } from '@/lib/stripe'
import { getPayload } from '@/lib/payload'

export const runtime = 'nodejs'

const err = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status })

type ShippingDetails = Stripe.Checkout.Session.CollectedInformation.ShippingDetails

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  const raw = await req.text() // raw body: the signature is computed over the exact bytes
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, sig ?? '', process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    // Rule B7 / G12: nothing is read or written before the signature verifies.
    return err(400, 'INVALID_SIGNATURE', 'Webhook signature verification failed.')
  }

  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.expired') {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object
  let order
  try {
    const payload = await getPayload()
    const found = await payload.find({
      collection: 'orders',
      overrideAccess: true,
      limit: 1,
      where: { stripeSessionId: { equals: session.id } },
    })
    order = found.docs[0]
    if (!order) return err(404, 'ORDER_NOT_FOUND', 'No order matches this Checkout Session.')

    // paid and cancelled are terminal (Rule B3). Replays (G13) and late events are acknowledged, not
    // retried: a non-2xx here would make Stripe retry for 3 days with no chance of succeeding.
    if (order.status !== 'pending') {
      console.warn(`order ${order.id} already ${order.status}, event ${event.id} ignored`)
      return NextResponse.json({ received: true })
    }

    if (event.type === 'checkout.session.completed') {
      if (session.payment_status !== 'paid') return NextResponse.json({ received: true }) // card-only → always 'paid' here; guard anyway
      // Newer API versions moved shipping to collected_information; older ones kept session.shipping_details.
      const ship =
        session.collected_information?.shipping_details ??
        (session as unknown as { shipping_details?: ShippingDetails | null }).shipping_details
      // The only place in the codebase that marks an order paid (SPEC Rule B7).
      await payload.update({
        collection: 'orders',
        id: order.id,
        overrideAccess: true,
        data: {
          status: 'paid',
          paidAt: new Date(event.created * 1000).toISOString(),
          stripePaymentIntentId:
            typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
          customerEmail: session.customer_details?.email ?? undefined,
          total: session.amount_total ?? order.total,
          shippingAddress: ship
            ? {
                name: ship.name ?? undefined,
                line1: ship.address?.line1 ?? undefined,
                line2: ship.address?.line2 ?? undefined,
                postalCode: ship.address?.postal_code ?? undefined,
                city: ship.address?.city ?? undefined,
                state: ship.address?.state ?? undefined,
                country: ship.address?.country ?? undefined,
              }
            : undefined,
        },
      })
    } else {
      // checkout.session.expired: pending → cancelled.
      await payload.update({ collection: 'orders', id: order.id, overrideAccess: true, data: { status: 'cancelled' } })
    }
  } catch {
    return err(500, 'INTERNAL', 'Webhook processing failed.')
  }
  return NextResponse.json({ received: true })
}
