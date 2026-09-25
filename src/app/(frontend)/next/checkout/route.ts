import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { z } from 'zod'

import { getPayload } from '@/lib/payload'
import { stripe } from '@/lib/stripe'
import { EUROPE_COUNTRIES } from '@/lib/countries'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

type Payload = Awaited<ReturnType<typeof getPayload>>

const Body = z.object({ productId: z.string().uuid() })

const err = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status })

const internal = () => err(500, 'INTERNAL', 'Something went wrong on our side. Nothing was charged.')

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!rateLimit(`checkout:${ip}`, 10, 60_000)) {
    return err(429, 'RATE_LIMITED', 'Too many checkout attempts. Please wait a minute and try again.')
  }

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return err(400, 'INVALID_BODY', 'Request body must contain a valid productId.')

  let orderId: string | undefined
  let payload: Payload | undefined
  try {
    payload = await getPayload()
    const product = await payload
      .findByID({ collection: 'products', id: parsed.data.productId, depth: 1 })
      .catch(() => null)
    if (!product) return err(404, 'PRODUCT_NOT_FOUND', 'This product does not exist.')
    // Rule B5: checked here, server-side; no order row is created for a sold-out product.
    if (product.soldOut) return err(409, 'SOLD_OUT', 'Sorry, this print just sold out.')
    if (!Number.isInteger(product.price) || product.price < 100) return internal()

    const base = process.env.NEXT_PUBLIC_SERVER_URL!
    // Stripe needs a public https URL; local-disk uploads in dev (/api/media/file/…) are simply omitted.
    const imageUrl = typeof product.image === 'object' ? product.image?.url : undefined
    const image = imageUrl?.startsWith('https://') ? [imageUrl] : []

    // 1) create the order first (pending), so the webhook always finds a row (Rule B2)
    const order = await createPendingOrder(payload, {
      items: [{ product: product.id, titleSnapshot: product.title, unitPrice: product.price, quantity: 1 }],
      total: product.price,
    })
    orderId = order.id

    // 2) create the Stripe session
    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          payment_method_types: ['card'],
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: 'eur',
                unit_amount: product.price,
                product_data: { name: product.title, description: product.shortDescription, images: image },
              },
            },
          ],
          shipping_address_collection: { allowed_countries: [...EUROPE_COUNTRIES] },
          metadata: { orderId: order.id, orderNumber: order.orderNumber },
          client_reference_id: order.id,
          success_url: `${base}/order/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${base}/products/${product.slug}?checkout=cancelled`,
          expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 h; minimum Stripe allows is 30 min
        },
        { idempotencyKey: `order-${order.id}`, timeout: 10_000 },
      )
    } catch {
      await cancelOrder(payload, order.id)
      return err(502, 'STRIPE_UNAVAILABLE', 'Checkout is temporarily unavailable. Please try again in a moment.')
    }

    // 3) bind the session to the order
    await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      data: { stripeSessionId: session.id },
    })

    if (!session.url) throw new Error('Checkout Session has no URL')
    return NextResponse.json({ url: session.url })
  } catch {
    // Rule B14: any failure after the DB write rolls the order to cancelled.
    if (payload && orderId) await cancelOrder(payload, orderId)
    return internal()
  }
}

type NewOrder = {
  items: { product: string; titleSnapshot: string; unitPrice: number; quantity: number }[]
  total: number
}

/** Rule B4: on an orderNumber collision, recompute once with +1; a second failure propagates (→ 500). */
async function createPendingOrder(payload: Payload, data: NewOrder) {
  const create = async (offset: number) =>
    payload.create({
      collection: 'orders',
      overrideAccess: true,
      data: {
        orderNumber: await nextOrderNumber(payload, offset),
        status: 'pending',
        stripeSessionId: `placeholder-${crypto.randomUUID()}`, // replaced below; column is NOT NULL UNIQUE
        items: data.items,
        currency: 'eur',
        total: data.total,
      },
    })
  try {
    return await create(0)
  } catch {
    return await create(1)
  }
}

async function nextOrderNumber(payload: Payload, offset: number): Promise<string> {
  const year = new Date().getUTCFullYear()
  const { totalDocs } = await payload.count({
    collection: 'orders',
    overrideAccess: true,
    where: { createdAt: { greater_than_equal: `${year}-01-01T00:00:00.000Z` } },
  })
  return `AM-${year}-${String(totalDocs + 1 + offset).padStart(6, '0')}`
}

async function cancelOrder(payload: Payload, id: string) {
  await payload
    .update({ collection: 'orders', id, overrideAccess: true, data: { status: 'cancelled' } })
    .catch(() => undefined)
}
