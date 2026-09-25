import Stripe from 'stripe'

// SPEC Rule B15: the app refuses to boot with anything but a test key. Never remove this guard.
if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
  throw new Error('STRIPE_SECRET_KEY must be a Stripe TEST key (sk_test_...). Live keys are forbidden in this project.')
}

// Fail fast: without it every real Stripe event would be rejected as INVALID_SIGNATURE.
if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET is not set')

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { typescript: true })
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
