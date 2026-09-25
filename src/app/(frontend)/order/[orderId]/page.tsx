import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Clock3, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatEUR } from '@/lib/money'
import { imageFor } from '@/lib/media'
import { getPayload } from '@/lib/payload'
import { cn } from '@/lib/utils'
import type { Order } from '@/payload-types'
import { OrderStatusPoller } from './OrderStatusPoller'

export const metadata: Metadata = { title: 'Your order', robots: { index: false, follow: false } }

type Props = {
  params: Promise<{ orderId: string }>
  searchParams: Promise<{ session_id?: string | string[] }>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Read-only (SPEC Rule B8): this page never writes to the order; only the webhook changes its status.
export default async function OrderPage({ params, searchParams }: Props) {
  const { orderId } = await params
  const { session_id: sessionId } = await searchParams
  if (!UUID.test(orderId) || typeof sessionId !== 'string') notFound()

  const payload = await getPayload()
  // Orders are admin-only through the API; the UUID + matching session id is the visitor's proof.
  const order = await payload
    .findByID({ collection: 'orders', id: orderId, depth: 2, overrideAccess: true })
    .catch(() => null)
  if (!order || order.stripeSessionId !== sessionId) notFound()

  return (
    <section id="order" data-order-status={order.status} className="mx-auto max-w-2xl">
      <StatusPill status={order.status} />
      {order.status === 'paid' ? (
        <Paid order={order} />
      ) : order.status === 'pending' ? (
        <OrderStatusPoller details={<OrderSummary order={order} />} />
      ) : (
        <Cancelled order={order} />
      )}
    </section>
  )
}

function Paid({ order }: { order: Order }) {
  const firstName = order.shippingAddress?.name?.trim().split(/\s+/)[0]
  return (
    <>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl">
        {firstName ? `Order paid — thank you, ${firstName}!` : 'Order paid — thank you!'}
      </h1>
      <p className="mt-2 text-[var(--text-muted)]">
        Order {order.orderNumber} · {formatDate(order.createdAt)}
      </p>
      <OrderSummary order={order} />
      <ShippingAddress address={order.shippingAddress} />
      {order.customerEmail && (
        <p className="mt-6 text-sm text-[var(--text-muted)]">
          A receipt was sent to {order.customerEmail} by Stripe (test mode).
        </p>
      )}
      <BackToPrints />
    </>
  )
}

function Cancelled({ order }: { order: Order }) {
  const product = order.items[0]?.product
  const href = product && typeof product === 'object' ? `/products/${product.slug}` : '/'
  return (
    <>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl">This checkout was not completed.</h1>
      <p className="mt-2 text-[var(--text-muted)]">
        Nothing was charged. You can start again from the{' '}
        <Link href={href} className="text-[var(--text)] underline underline-offset-4">
          product page
        </Link>
        .
      </p>
      <BackToPrints />
    </>
  )
}

function OrderSummary({ order }: { order: Order }) {
  return (
    <div className="mt-8 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-6">
      {order.items.map((item) => {
        // Product may have been deleted since (G7): fall back to the snapshot and a neutral square.
        const img = item.product && typeof item.product === 'object' ? imageFor(item.product.image, 'card') : null
        return (
          <div key={item.id ?? item.titleSnapshot} className="flex gap-4">
            {img ? (
              <Image
                src={img.url}
                alt={img.alt}
                width={img.width}
                height={img.height}
                sizes="80px"
                className="h-24 w-20 rounded object-cover"
              />
            ) : (
              <div className="h-24 w-20 shrink-0 rounded bg-[var(--surface-2)]" />
            )}
            <div>
              <p className="font-medium">{item.titleSnapshot}</p>
              <p className="text-sm text-[var(--text-muted)] tabular-nums">
                {item.quantity} × {formatEUR(item.unitPrice)} <span className="text-sm text-[var(--text-muted)]">incl. VAT</span>
              </p>
            </div>
          </div>
        )
      })}
      <hr className="my-4 border-[var(--border)]" />
      <p className="flex justify-between">
        <span>Total</span>
        <span className="tabular-nums">
          {formatEUR(order.total)} <span className="text-sm text-[var(--text-muted)]">incl. VAT</span>
        </span>
      </p>
    </div>
  )
}

function ShippingAddress({ address }: { address: Order['shippingAddress'] }) {
  if (!address?.line1) return null
  const cityLine = [address.postalCode, address.city].filter(Boolean).join(' ')
  const lines = [address.name, address.line1, address.line2, cityLine, address.state, countryName(address.country)]
  return (
    <div id="shipping" className="mt-6 text-sm">
      <h2 className="font-medium">Ships to</h2>
      <address className="mt-1 text-[var(--text-muted)] not-italic">
        {lines.filter(Boolean).map((line, i) => (
          <span key={i} className="block">
            {line}
          </span>
        ))}
      </address>
    </div>
  )
}

const PILLS = {
  paid: { label: 'Paid', Icon: CheckCircle2, color: 'var(--success)' },
  pending: { label: 'Confirming…', Icon: Clock3, color: 'var(--accent)' },
  cancelled: { label: 'Cancelled', Icon: XCircle, color: 'var(--danger)' },
} as const

function StatusPill({ status }: { status: Order['status'] }) {
  const { label, Icon, color } = PILLS[status]
  return (
    <Badge
      variant="secondary"
      className={cn('status-pill', `status-${status}`)}
      style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
    >
      <Icon aria-hidden /> {label}
    </Badge>
  )
}

function BackToPrints() {
  return (
    <Button asChild variant="outline" className="btn-secondary mt-8 h-10 border-[var(--border)] text-[var(--text)]">
      <Link href="/">
        <ArrowLeft aria-hidden /> Back to prints
      </Link>
    </Button>
  )
}

// G25: dates shown in Europe/Berlin, e.g. "24 Sep 2026".
const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(iso),
  )

const countryName = (code?: string | null) => {
  if (!code) return null
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}
