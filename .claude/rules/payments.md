---
paths:
  - "src/app/(frontend)/next/**"
  - "src/collections/Orders.ts"
  - "src/lib/stripe.ts"
  - "src/app/(frontend)/order/**"
---

# Payments rules (SPEC.md Blocks D, F §Payments, G §Payments)

- Order lifecycle: `pending → paid` only in the webhook handler after `constructEvent` succeeds; `pending → cancelled` on `checkout.session.expired` or on Stripe create failure. `paid` and `cancelled` are terminal.
- The order row is created **before** `stripe.checkout.sessions.create` and bound to `session.id` right after. Use `idempotencyKey: order-<uuid>` and `timeout: 10_000`.
- Webhook: read the body with `await req.text()` (raw), verify with `STRIPE_WEBHOOK_SECRET`, return 400 `INVALID_SIGNATURE` on failure **before** touching the database. Return 200 for already-paid orders (idempotent) and for ignored event types.
- Read shipping from `session.collected_information?.shipping_details` first, fall back to `session.shipping_details`.
- Sold-out is checked server-side at session creation → 409 `SOLD_OUT`. No order row is created in that case.
- The confirmation page (`/order/[orderId]`) is read-only and returns `notFound()` unless `searchParams.session_id === order.stripeSessionId`.
- Error responses always use `{ "error": { "code", "message" } }` with the exact codes and copy from SPEC.md Block D.
- Never add Stripe.js, Elements, or the publishable key to the browser. Hosted Checkout only.
- Never create Stripe Products or Prices; pass `price_data` inline.
