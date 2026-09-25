# Go-live plan: accepting real payments

**Status: written, not executed.** The shop runs on Stripe test keys only. This plan lists the steps to take real money, in order. It is based on Stripe's [Go Live Checklist](https://docs.stripe.com/get-started/checklist/go-live).

## 1. Legal and tax (before anything technical)

- **Replace the draft legal texts.** The seeded Impressum, Privacy and Terms & Returns pages are drafts. Have them reviewed or rewritten (§5 DDG, GDPR Art. 13, BGB §312g 14-day withdrawal) and publish them in `/admin` → Pages.
- **VAT and OSS.** Prices are shown incl. VAT and shipped across Europe. Cross-border B2C sales inside the EU are reported through the Union One-Stop Shop (OSS) with a single registration and return, and a domestic German VAT registration is still required. Confirm the rates and thresholds with a tax advisor. Stripe Tax is not used; if it were enabled later, it collects tax only where an active registration has been added.
- **Remove the "test mode" copy.** The footer ("Payments by Stripe (test mode)") and the order confirmation receipt line mention test mode. Update both strings in SPEC.md and in code.

## 2. Activate the Stripe account

- In the Stripe Dashboard, complete account activation: business details, bank account for payouts, identity verification.
- Set the statement descriptor and the public business name/support email shown on Checkout and receipts.
- Turn on email receipts for successful payments in live mode.
- Rotate any test keys that were ever stored outside Vercel and the local `.env`.

## 3. Register the live webhook endpoint

- Test mode and live mode have **separate** webhook endpoints. In live mode, add `https://atelier-margoche-shop.vercel.app/next/stripe/webhook` with the events `checkout.session.completed` and `checkout.session.expired`.
- Copy the new live **signing secret** (`whsec_…`). It differs from the test one and is used in step 5.
- The handler already copes with delayed, duplicate and out-of-order events: it verifies the signature, ignores any event for an order that is no longer `pending`, and returns 200.

## 4. Products and prices: nothing to recreate

Test-mode Stripe objects (Products, Prices, coupons) cannot be used in live mode. This shop creates none: `/next/checkout` sends each item as inline `price_data` (name, unit amount in cents, EUR) taken from Payload. Payload stays the single source of prices, and nothing needs recreating in live mode.

If the app switched to Stripe Prices (`line_items[].price = 'price_…'`), every Product and Price would have to be recreated in live mode. Their IDs would need storing per product in Payload (a test ID and a live ID, or one per environment), and price edits in `/admin` would have to create new Stripe Prices, because Prices are immutable. That is the main reason inline `price_data` was chosen.

## 5. Swap keys and remove the test-key guard (last step)

`src/lib/stripe.ts` throws at import unless `STRIPE_SECRET_KEY` starts with `sk_test_` (SPEC Rule B15). The guard exists so a live key pasted into Vercel or `.env` by mistake cannot take real money from an unfinished shop. The deployment fails instead (Edge case G18). It must therefore go **last**, in one deliberate change:

1. In Vercel → Settings → Environment Variables → **Production only**, set `STRIPE_SECRET_KEY` to the live `sk_live_…` key (or a restricted `rk_live_…` key allowed only to create Checkout Sessions) and `STRIPE_WEBHOOK_SECRET` to the live signing secret from step 3. **Preview and local keep test keys.**
2. Open a PR that removes the guard, or better, changes it to accept `sk_live_`/`rk_live_` only when `VERCEL_ENV === 'production'`. Update Rule B15, G18 and CLAUDE.md in the same PR.
3. Merge and let Vercel deploy. The new env values take effect with this deployment only.
4. Smoke test with a real card and a small amount. Check that the order turns `paid` via the webhook, that Dashboard → Webhooks shows 200s, then refund the payment in the Dashboard.

## 6. Rollback plan

- **Instant:** Vercel → Deployments → the last test-mode deployment → **Instant Rollback**. This restores the previous build, including its guard, but env variables are not rolled back. Also set the Production `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` back to the test values, so the next deployment doesn't boot with live keys and fail.
- **Stop taking payments without a deploy:** mark every product **Sold out** in `/admin`. Checkout then returns 409 and no Stripe session is created.
- If a live key leaked, roll it in the Stripe Dashboard first, then update Vercel.
- Orders paid in live mode stay in the database. Refund them in the Stripe Dashboard and record it in the order's owner note.
