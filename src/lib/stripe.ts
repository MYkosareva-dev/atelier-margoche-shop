import Stripe from 'stripe'

// SPEC Rule B15: the app refuses to boot with anything but a test key. Never remove this guard.
if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
  throw new Error('STRIPE_SECRET_KEY must be a Stripe TEST key (sk_test_...). Live keys are forbidden in this project.')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { typescript: true })
